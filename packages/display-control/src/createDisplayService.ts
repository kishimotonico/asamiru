import type { DisplayCapabilities, DesiredDisplayPower, DisplayEvent, DisplayStatus, DisplayErrorCode } from "@asamiru/shared";
import type { DisplayDriver } from "./displayDriver.js";
import { DdcCiDisplayDriver, type DdcSelector } from "./ddcCiDisplayDriver.js";
import { FakeDisplayDriver } from "./fakeDisplayDriver.js";
import { DisplayService } from "./displayService.js";

export type DisplayServiceOptions =
  | { enabled: false }
  | { enabled: true; driver: "fake"; connector: string }
  | { enabled: true; driver: "ddc-ci"; connector: string; selector: DdcSelector };

/** 機能無効時に返す NullService */
class NullDisplayService {
  readonly enabled = false as const;

  getStatus(): null {
    return null;
  }

  subscribe(_cb: (event: DisplayEvent) => void): () => void {
    return () => {};
  }

  async start(): Promise<void> {}

  stop(): void {}

  async setDesiredPower(_desired: DesiredDisplayPower): Promise<void> {
    throw Object.assign(new Error("Display control is not enabled"), { code: "not_enabled" as DisplayErrorCode });
  }
}

/** 機能有効時の実サービスラッパー */
class ActiveDisplayService {
  readonly enabled = true as const;
  readonly #service: DisplayService;
  readonly #driverLabel: string;
  readonly #selectorLabel: string;
  readonly #connector: string;
  #diagnosticUnsubscribe: (() => void) | null = null;
  #lastLoggedStatus: DisplayStatus | null = null;
  /** fake driver のときだけ定義される。ddc-ci では undefined（_fake エンドポイントを弾く）*/
  readonly simulateExternal?: (power: "on" | "off") => void;

  constructor(
    service: DisplayService,
    fakeDriver: FakeDisplayDriver | null,
    meta: { driverLabel: string; selectorLabel: string; connector: string },
  ) {
    this.#service = service;
    this.#driverLabel = meta.driverLabel;
    this.#selectorLabel = meta.selectorLabel;
    this.#connector = meta.connector;
    if (fakeDriver) {
      this.simulateExternal = (power) => fakeDriver.simulateExternal(power);
    }
  }

  getStatus(): DisplayStatus {
    return this.#service.getStatus();
  }

  subscribe(cb: (event: DisplayEvent) => void): () => void {
    return this.#service.subscribe(cb);
  }

  async start(): Promise<void> {
    console.log(
      `[display] starting driver=${this.#driverLabel} target=${this.#selectorLabel} connector=${this.#connector}`,
    );
    await this.#service.start();

    const status = this.#service.getStatus();
    this.#logStatus("initial", status, true);

    // 起動時の初回観測でモニターが応答しなければ警告（暗黙無効化はしない）。
    // 番号・connector の指定ミスを起動時点で気づけるようにする。
    if (status.error || status.connection === "unknown") {
      const reason = status.error ? `error=${status.error.code}` : `connection=${status.connection}`;
      console.warn(
        `[display] WARNING monitor did not respond target=${this.#selectorLabel} connector=${this.#connector} ` +
          `${reason}; check ddcutil detect and /sys/class/drm`,
      );
    }

    if (!this.#diagnosticUnsubscribe) {
      this.#diagnosticUnsubscribe = this.#service.subscribe((event) => {
        this.#logStatus(event.trigger, event.status);
      });
    }
  }

  stop(): void {
    this.#diagnosticUnsubscribe?.();
    this.#diagnosticUnsubscribe = null;
    this.#service.stop();
  }

  async setDesiredPower(desired: DesiredDisplayPower): Promise<void> {
    console.log(
      `[display] desired-power requested target=${this.#selectorLabel} connector=${this.#connector} desired=${desired}`,
    );
    try {
      await this.#service.setDesiredPower(desired);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[display] desired-power failed target=${this.#selectorLabel} connector=${this.#connector} ` +
          `desired=${desired} error=${JSON.stringify(message)}`,
      );
      throw error;
    }
  }

  #logStatus(trigger: string, status: DisplayStatus, force = false): void {
    const previous = this.#lastLoggedStatus;
    const errorKey = status.error ? `${status.error.code}:${status.error.message}` : null;
    const previousErrorKey = previous?.error ? `${previous.error.code}:${previous.error.message}` : null;
    const changed =
      !previous ||
      previous.connection !== status.connection ||
      previous.power !== status.power ||
      previous.desiredPower !== status.desiredPower ||
      previous.commandPhase !== status.commandPhase ||
      previousErrorKey !== errorKey;

    this.#lastLoggedStatus = status;
    if (!force && !changed) return;

    const error = status.error
      ? ` error=${status.error.code}:${JSON.stringify(status.error.message)}`
      : "";
    console.log(
      `[display] status trigger=${trigger} target=${this.#selectorLabel} connector=${status.connector} ` +
        `connection=${status.connection} power=${status.power} origin=${status.powerOrigin} ` +
        `desired=${status.desiredPower ?? "none"} phase=${status.commandPhase} ` +
        `observedAt=${status.lastObservedAt ?? "none"}${error}`,
    );
  }
}

export type CreatedDisplayService = NullDisplayService | ActiveDisplayService;

const DEFAULT_CAPABILITIES: DisplayCapabilities = {
  canReadConnection: true,
  canReadPower: true,
  canSetPowerOn: true,
  canSetStandby: true,
};

/**
 * 環境設定から DisplayService を生成する。
 * enabled=false の場合は一切のハードウェアアクセスを行わない NullService を返す。
 * enabled=true で driver が利用不能な場合はエラーをスロー（暗黙無効化しない）。
 */
export function createDisplayService(options: DisplayServiceOptions): CreatedDisplayService {
  if (!options.enabled) {
    return new NullDisplayService();
  }

  let driver: DisplayDriver;
  let fakeDriver: FakeDisplayDriver | null = null;
  let driverLabel: string;
  let selectorLabel: string;

  if (options.driver === "fake") {
    fakeDriver = new FakeDisplayDriver("on");
    driver = fakeDriver;
    driverLabel = "fake";
    selectorLabel = "in-memory";
  } else {
    driver = new DdcCiDisplayDriver({
      selector: options.selector,
      connector: options.connector,
    });
    driverLabel = "ddc-ci";
    selectorLabel = `--${options.selector.kind} ${options.selector.value}`;
  }

  const service = new DisplayService(driver, {
    connector: options.connector,
    capabilities: DEFAULT_CAPABILITIES,
  });

  return new ActiveDisplayService(service, fakeDriver, {
    driverLabel,
    selectorLabel,
    connector: options.connector,
  });
}
