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
  readonly #selectorLabel: string;
  readonly #connector: string;
  /** fake driver のときだけ定義される。ddc-ci では undefined（_fake エンドポイントを弾く）*/
  readonly simulateExternal?: (power: "on" | "off") => void;

  constructor(
    service: DisplayService,
    fakeDriver: FakeDisplayDriver | null,
    meta: { selectorLabel: string; connector: string },
  ) {
    this.#service = service;
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
    await this.#service.start();
    // 起動時の初回観測でモニターが応答しなければ警告（暗黙無効化はしない）。
    // 番号・connector の指定ミスを起動時点で気づけるようにする。
    const status = this.#service.getStatus();
    if (status.error || status.connection === "unknown") {
      const reason = status.error ? `error=${status.error.code}` : `connection=${status.connection}`;
      console.warn(
        `[display] WARNING: モニターが応答しません (${this.#selectorLabel}, connector=${this.#connector})。` +
          ` ddcutil detect で番号を、/sys/class/drm で connector 名を確認してください。${reason}`,
      );
    }
  }

  stop(): void {
    this.#service.stop();
  }

  async setDesiredPower(desired: DesiredDisplayPower): Promise<void> {
    return this.#service.setDesiredPower(desired);
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
  let selectorLabel: string;

  if (options.driver === "fake") {
    fakeDriver = new FakeDisplayDriver("on");
    driver = fakeDriver;
    selectorLabel = "driver=fake";
  } else {
    driver = new DdcCiDisplayDriver({
      selector: options.selector,
      connector: options.connector,
    });
    selectorLabel = `${options.selector.kind}=${options.selector.value}`;
  }

  const service = new DisplayService(driver, {
    connector: options.connector,
    capabilities: DEFAULT_CAPABILITIES,
  });

  return new ActiveDisplayService(service, fakeDriver, {
    selectorLabel,
    connector: options.connector,
  });
}
