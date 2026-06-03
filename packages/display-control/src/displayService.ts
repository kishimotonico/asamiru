import type {
  DisplayCapabilities,
  DisplayCommandPhase,
  DisplayConnection,
  DisplayErrorCode,
  DisplayEvent,
  DisplayObservationTrigger,
  DisplayPower,
  DisplayPowerOrigin,
  DisplayStatus,
  DesiredDisplayPower,
} from "@asamiru/shared";
import type { DisplayDriver } from "./displayDriver.js";
import type { FakeDisplayDriver } from "./fakeDisplayDriver.js";
import { startUdevMonitor } from "./udevMonitor.js";

const POLL_MS = 5_000;
const HOTPLUG_DEBOUNCE_MS = 1_000;
const HOTPLUG_RETRY_INTERVAL_MS = 1_000;
const HOTPLUG_RETRY_COUNT = 4;
/** settling フェーズの確認期限（物理ON復帰途中の ~3.5s disconnected を跨ぐため最低6秒）*/
const SETTLING_TIMEOUT_MS = 7_000;
/** OFF と判定するのに必要な連続観測回数 */
const OFF_CONFIRM_COUNT = 2;
/** udevadm 再起動の初期待機 ms */
const UDEV_BACKOFF_INITIAL_MS = 1_000;
const UDEV_BACKOFF_MAX_MS = 30_000;

type DriverError = { code: DisplayErrorCode; message: string; occurredAt: string };

function makeError(code: DisplayErrorCode, message: string): DriverError {
  return { code, message, occurredAt: new Date().toISOString() };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type DisplayServiceConfig = {
  connector: string;
  capabilities: DisplayCapabilities;
};

export class DisplayService {
  readonly #driver: DisplayDriver;
  readonly #connector: string;
  readonly #capabilities: DisplayCapabilities;
  readonly #subscribers: Array<(event: DisplayEvent) => void> = [];

  // 現在の観測状態
  #connection: DisplayConnection = "unknown";
  #power: DisplayPower = "unknown";
  #powerOrigin: DisplayPowerOrigin = "unknown";
  #desiredPower: DesiredDisplayPower | null = null;
  #commandPhase: DisplayCommandPhase = "idle";
  #lastObservedAt: string | null = null;
  #lastCommandAt: string | null = null;
  #error: DriverError | null = null;
  #settlingTimer: ReturnType<typeof setTimeout> | null = null;
  /** OFF 連続観測カウンタ */
  #offConsecutive = 0;

  // 実行管理
  #started = false;
  #stopped = false;
  #pollTimer: ReturnType<typeof setInterval> | null = null;
  #hotplugDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  #udevStop: (() => void) | null = null;
  #udevBackoff = UDEV_BACKOFF_INITIAL_MS;
  #fakeUnsubscribe: (() => void) | null = null;

  // DRM/DDC アクセスを直列化する実行キュー
  #queue: Promise<void> = Promise.resolve();
  #pending = 0;

  constructor(driver: DisplayDriver, config: DisplayServiceConfig) {
    this.#driver = driver;
    this.#connector = config.connector;
    this.#capabilities = config.capabilities;
  }

  getStatus(): DisplayStatus {
    return {
      connector: this.#connector,
      connection: this.#connection,
      power: this.#power,
      powerOrigin: this.#powerOrigin,
      desiredPower: this.#desiredPower,
      commandPhase: this.#commandPhase,
      capabilities: this.#capabilities,
      lastObservedAt: this.#lastObservedAt,
      lastCommandAt: this.#lastCommandAt,
      error: this.#error,
    };
  }

  subscribe(cb: (event: DisplayEvent) => void): () => void {
    this.#subscribers.push(cb);
    return () => {
      const idx = this.#subscribers.indexOf(cb);
      if (idx !== -1) this.#subscribers.splice(idx, 1);
    };
  }

  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;

    // FakeDisplayDriver のシミュレーション通知を購読
    if (isFakeDriver(this.#driver)) {
      this.#fakeUnsubscribe = this.#driver.onSimulate((power) => {
        this.#handleFakeExternal(power);
      });
    }

    // 初回 snapshot（外部操作判定はしない）
    await this.#enqueue(() => this.#observe("initial"));

    // udev 常駐監視を開始
    this.#startUdev();

    // polling（skip-if-busy）
    this.#pollTimer = setInterval(() => {
      this.#pollIfIdle();
    }, POLL_MS);
  }

  stop(): void {
    if (this.#stopped) return;
    this.#stopped = true;
    if (this.#pollTimer) clearInterval(this.#pollTimer);
    if (this.#hotplugDebounceTimer) clearTimeout(this.#hotplugDebounceTimer);
    if (this.#settlingTimer) clearTimeout(this.#settlingTimer);
    if (this.#udevStop) this.#udevStop();
    if (this.#fakeUnsubscribe) this.#fakeUnsubscribe();
  }

  /** desired power をサーバーへ伝達。目標 == 観測 なら送らない（skip-if-matches）。
   *  DDC コマンドが失敗した場合は例外を伝播する。 */
  async setDesiredPower(desired: DesiredDisplayPower): Promise<void> {
    if (!this.#started) throw new Error("DisplayService not started");

    this.#desiredPower = desired;

    const targetPower = desired === "standby" ? "off" : "on";
    if (this.#power === targetPower && this.#commandPhase === "idle") return;

    await this.#enqueue(() => this.#runCommand(desired));
  }

  // ────────── 実行キュー（直列化） ──────────

  /** タスクをキューに積み、前のタスク完了後に直列実行する。
   *  タスクの成否は呼び出し元へ伝播するが、後続キューは成否に関わらず進む。 */
  #enqueue<T>(task: () => Promise<T>): Promise<T> {
    this.#pending += 1;
    const run = this.#queue.then(task, task);
    // 次のキュー基点は成否を握りつぶす
    this.#queue = run.then(
      () => {},
      () => {},
    );
    // pending カウントの減算（reject も確実に処理し unhandled rejection を防ぐ）
    run.then(
      () => {
        this.#pending -= 1;
      },
      () => {
        this.#pending -= 1;
      },
    );
    return run;
  }

  get #busy(): boolean {
    return this.#pending > 0;
  }

  // ────────── 観測・コマンド ──────────

  #emit(trigger: DisplayObservationTrigger): void {
    const event: DisplayEvent = { status: this.getStatus(), trigger };
    for (const cb of this.#subscribers) cb(event);
  }

  #startSettling(): void {
    if (this.#settlingTimer) clearTimeout(this.#settlingTimer);
    this.#commandPhase = "settling";
    this.#settlingTimer = setTimeout(() => {
      if (this.#commandPhase === "settling") {
        this.#commandPhase = "idle";
      }
    }, SETTLING_TIMEOUT_MS);
  }

  /** DDC コマンドを送る。失敗時は例外を伝播する（呼び出し元の setDesiredPower 経由で API へ）*/
  async #runCommand(desired: DesiredDisplayPower): Promise<void> {
    this.#commandPhase = "commanding";
    this.#powerOrigin = "command"; // 以降の観測はコマンド由来
    this.#lastCommandAt = new Date().toISOString();
    this.#emit("command-confirmation");

    try {
      if (desired === "standby") {
        await this.#driver.setStandby();
      } else {
        await this.#driver.setPowerOn();
      }
    } catch (error) {
      this.#commandPhase = "idle";
      this.#error = makeError("ddc_failed", error instanceof Error ? error.message : String(error));
      this.#emit("command-confirmation");
      throw error;
    }

    // 自分が送ったコマンドの結果は信頼する（OFF連続確定は外部観測の誤検知防止用）
    this.#power = desired === "standby" ? "off" : "on";
    this.#offConsecutive = desired === "standby" ? OFF_CONFIRM_COUNT : 0;
    this.#error = null;

    this.#startSettling();
    await this.#observe("command-confirmation");
  }

  #pollIfIdle(): void {
    if (this.#stopped || this.#busy) return; // skip-if-busy
    void this.#enqueue(() => this.#observe("poll"));
  }

  /** 1回の状態観測。キュー内で直列実行される前提（busy チェックはしない） */
  async #observe(trigger: DisplayObservationTrigger): Promise<void> {
    if (this.#stopped) return;

    const [connResult, powerResult] = await Promise.allSettled([
      this.#driver.readConnection(),
      this.#driver.readPower(),
    ]);

    const prevPower = this.#power;

    // 接続状態
    if (connResult.status === "fulfilled") {
      this.#connection = connResult.value.connection;
    }

    // 電源状態（OFF は連続 OFF_CONFIRM_COUNT 回で確定）
    if (powerResult.status === "fulfilled") {
      const { power, error } = powerResult.value;
      if (error) {
        this.#error = makeError(
          error.startsWith("display_not_found") ? "display_not_found" : "ddc_failed",
          error,
        );
        this.#power = "unknown";
        this.#offConsecutive = 0;
      } else if (power === "off") {
        this.#offConsecutive += 1;
        if (this.#offConsecutive >= OFF_CONFIRM_COUNT) {
          this.#power = "off";
        }
        this.#error = null;
      } else {
        this.#offConsecutive = 0;
        this.#power = power;
        this.#error = null;
      }
    } else {
      this.#offConsecutive = 0;
      this.#power = "unknown";
    }

    this.#lastObservedAt = new Date().toISOString();

    // powerOrigin 判定:
    // - 初回観測は判定しない（起動しただけで external 扱いにしない）
    // - コマンド中・settling 中の変化はコマンド由来
    // - idle 中に power が変化したら外部操作
    if (trigger === "initial") {
      this.#powerOrigin = "unknown";
    } else if (this.#commandPhase !== "idle") {
      this.#powerOrigin = "command";
    } else if (this.#power !== "unknown" && this.#power !== prevPower) {
      this.#powerOrigin = "external";
    } else {
      this.#powerOrigin = "unknown";
    }

    this.#emit(trigger);
  }

  // ────────── udev 管理 ──────────

  #startUdev(): void {
    if (this.#stopped) return;

    const restart = async () => {
      if (this.#stopped) return;
      await sleep(this.#udevBackoff);
      this.#udevBackoff = Math.min(this.#udevBackoff * 2, UDEV_BACKOFF_MAX_MS);
      if (this.#stopped) return;
      // 再起動前に full snapshot（イベント取りこぼし対策）
      await this.#enqueue(() => this.#observe("poll"));
      this.#startUdev();
    };

    const { stop, onExit } = startUdevMonitor(
      () => this.#onHotplug(),
      (err) => {
        // 起動失敗・権限エラー等。クラッシュさせず再起動フローに委ねる
        console.error(`[display] udevadm monitor error: ${err.message}`);
      },
    );
    this.#udevStop = stop;

    void onExit.then(restart);
  }

  #onHotplug(): void {
    if (this.#stopped) return;
    // debounce: 1秒以内に複数発生した hotplug を1回にまとめる
    if (this.#hotplugDebounceTimer) clearTimeout(this.#hotplugDebounceTimer);
    this.#hotplugDebounceTimer = setTimeout(() => {
      void this.#enqueue(() => this.#handleHotplug());
    }, HOTPLUG_DEBOUNCE_MS);
  }

  async #handleHotplug(): Promise<void> {
    // リトライ付きで観測。unknown が続く場合は一定回数再試行（復帰途中の過渡状態対策）
    for (let attempt = 0; attempt <= HOTPLUG_RETRY_COUNT; attempt += 1) {
      if (this.#stopped) return;
      await this.#observe("hotplug");
      if (this.#power !== "unknown") return;
      if (attempt < HOTPLUG_RETRY_COUNT) await sleep(HOTPLUG_RETRY_INTERVAL_MS);
    }
  }

  // ────────── Fake driver 用 ──────────

  #handleFakeExternal(power: DisplayPower): void {
    if (this.#stopped) return;
    void this.#enqueue(async () => {
      if (this.#stopped) return;
      if (this.#commandPhase !== "idle") return; // コマンド中は無視
      const prevPower = this.#power;
      if (power === prevPower) return;

      this.#power = power;
      this.#powerOrigin = "external";
      this.#lastObservedAt = new Date().toISOString();
      this.#offConsecutive = power === "off" ? OFF_CONFIRM_COUNT : 0;
      this.#emit("poll");
    });
  }
}

// FakeDisplayDriver かを判定する型ガード（duck typing）
function isFakeDriver(driver: DisplayDriver): driver is FakeDisplayDriver {
  return typeof (driver as FakeDisplayDriver).onSimulate === "function";
}
