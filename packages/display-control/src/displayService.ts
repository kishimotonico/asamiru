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

  // 実行フラグ
  #started = false;
  #stopped = false;
  #busy = false;
  #pollTimer: ReturnType<typeof setInterval> | null = null;
  #hotplugDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  #udevStop: (() => void) | null = null;
  /** udev 再起動バックオフ ms */
  #udevBackoff = UDEV_BACKOFF_INITIAL_MS;
  #fakeUnsubscribe: (() => void) | null = null;

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

    // 初回 snapshot
    await this.#takeSnapshot("initial");

    // udev 常駐監視を開始
    this.#startUdev();

    // polling
    this.#pollTimer = setInterval(() => {
      void this.#pollIfIdle();
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

  /** desired power をサーバーへ伝達。目標 == 観測 なら送らない（skip-if-matches）*/
  async setDesiredPower(desired: DesiredDisplayPower): Promise<void> {
    if (!this.#started) throw new Error("DisplayService not started");

    this.#desiredPower = desired;

    // skip-if-matches: 観測値が既に目標と一致
    const targetPower = desired === "standby" ? "off" : "on";
    if (this.#power === targetPower && this.#commandPhase === "idle") return;

    await this.#sendCommand(desired);
  }

  // ────────── Private ──────────

  #emit(trigger: DisplayObservationTrigger): void {
    const event: DisplayEvent = { status: this.getStatus(), trigger };
    for (const cb of this.#subscribers) cb(event);
  }

  /** settling フェーズを開始。期限が過ぎたら idle に戻す */
  #startSettling(): void {
    if (this.#settlingTimer) clearTimeout(this.#settlingTimer);
    this.#commandPhase = "settling";
    this.#settlingTimer = setTimeout(() => {
      if (this.#commandPhase === "settling") {
        this.#commandPhase = "idle";
      }
    }, SETTLING_TIMEOUT_MS);
  }

  /** DDC コマンドを送り、commandPhase を更新する */
  async #sendCommand(desired: DesiredDisplayPower): Promise<void> {
    this.#commandPhase = "commanding";
    this.#lastCommandAt = new Date().toISOString();
    this.#emit("initial"); // commandPhase 変化を通知

    try {
      if (desired === "standby") {
        await this.#driver.setStandby();
      } else {
        await this.#driver.setPowerOn();
      }
      this.#startSettling();
      // コマンド直後に確認 snapshot
      await this.#takeSnapshot("command-confirmation");
    } catch (error) {
      this.#commandPhase = "idle";
      this.#error = makeError("ddc_failed", error instanceof Error ? error.message : String(error));
      this.#emit("command-confirmation");
    }
  }

  async #pollIfIdle(): Promise<void> {
    if (this.#busy || this.#stopped) return; // skip-if-busy
    await this.#takeSnapshot("poll");
  }

  async #takeSnapshot(trigger: DisplayObservationTrigger): Promise<void> {
    if (this.#stopped) return;
    if (this.#busy && trigger !== "command-confirmation") return; // コマンド確認は優先
    this.#busy = true;
    try {
      const [connResult, powerResult] = await Promise.allSettled([
        this.#driver.readConnection(),
        this.#driver.readPower(),
      ]);

      const prevPower = this.#power;
      const prevCommandPhase = this.#commandPhase;

      // 接続状態を更新
      if (connResult.status === "fulfilled") {
        this.#connection = connResult.value.connection;
      }

      // 電源状態を更新（OFF は連続 OFF_CONFIRM_COUNT 回で確定）
      if (powerResult.status === "fulfilled") {
        const { power, error } = powerResult.value;
        if (error) {
          this.#error = makeError(
            error.startsWith("display_not_found") ? "display_not_found" : "ddc_failed",
            error,
          );
          // エラーは unknown だが OFF 確定はしない
          this.#power = "unknown";
          this.#offConsecutive = 0;
        } else if (power === "off") {
          this.#offConsecutive += 1;
          if (this.#offConsecutive >= OFF_CONFIRM_COUNT) {
            this.#power = "off";
          }
          // 確定前は現在値を維持（unknown でなければ）
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

      // settling 明けに power が変化 → 外部操作と判定
      if (prevCommandPhase === "settling" && trigger !== "command-confirmation") {
        this.#powerOrigin = "command";
      } else if (this.#commandPhase === "idle" && this.#power !== "unknown" && this.#power !== prevPower) {
        this.#powerOrigin = "external";
      } else if (trigger === "command-confirmation") {
        this.#powerOrigin = "command";
        // settling から idle への遷移は settling タイマーに任せる
        if (this.#commandPhase === "settling") {
          // settling タイムアウト前にコマンド確認が取れた場合は settling を維持
        }
      } else {
        this.#powerOrigin = "unknown";
      }
    } finally {
      this.#busy = false;
    }

    this.#emit(trigger);
  }

  // ────────── udev 管理 ──────────

  #startUdev(): void {
    if (this.#stopped) return;
    const { stop, onExit } = startUdevMonitor((event) => {
      if (this.#stopped) return;
      // debounce: 1秒以内に複数発生した hotplug を1回にまとめる
      if (this.#hotplugDebounceTimer) clearTimeout(this.#hotplugDebounceTimer);
      this.#hotplugDebounceTimer = setTimeout(() => {
        void this.#handleHotplug();
      }, HOTPLUG_DEBOUNCE_MS);
    });
    this.#udevStop = stop;

    onExit.then(async () => {
      if (this.#stopped) return;
      await sleep(this.#udevBackoff);
      this.#udevBackoff = Math.min(this.#udevBackoff * 2, UDEV_BACKOFF_MAX_MS);
      // 再起動前に full snapshot（イベント取りこぼし対策）
      await this.#takeSnapshot("poll");
      this.#startUdev();
    });
  }

  async #handleHotplug(): Promise<void> {
    // リトライ付きで snapshot。unknown が続く場合は一定回数再試行
    for (let attempt = 0; attempt <= HOTPLUG_RETRY_COUNT; attempt += 1) {
      if (this.#stopped) return;
      const trigger: DisplayObservationTrigger = "hotplug";
      await this.#takeSnapshotForHotplug(trigger);
      if (this.#power !== "unknown") return;
      if (attempt < HOTPLUG_RETRY_COUNT) await sleep(HOTPLUG_RETRY_INTERVAL_MS);
    }
  }

  async #takeSnapshotForHotplug(trigger: DisplayObservationTrigger): Promise<void> {
    // busy でも hotplug は強制実行（busy フラグをリセットしてから呼ぶ）
    this.#busy = false;
    await this.#takeSnapshot(trigger);
  }

  // ────────── Fake driver 用 ──────────

  #handleFakeExternal(power: DisplayPower): void {
    if (this.#stopped) return;
    if (this.#commandPhase !== "idle") return; // コマンド中は無視

    const prevPower = this.#power;
    if (power === prevPower) return;

    this.#power = power;
    this.#powerOrigin = "external";
    this.#lastObservedAt = new Date().toISOString();
    this.#offConsecutive = power === "off" ? OFF_CONFIRM_COUNT : 0;
    this.#emit("poll"); // fake では poll trigger で通知
  }
}

// FakeDisplayDriver かを判定するための型ガード（duck typing）
function isFakeDriver(driver: DisplayDriver): driver is FakeDisplayDriver {
  return typeof (driver as FakeDisplayDriver).onSimulate === "function";
}
