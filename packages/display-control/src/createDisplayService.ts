import type { DisplayCapabilities, DesiredDisplayPower, DisplayEvent, DisplayStatus, DisplayErrorCode } from "@asamiru/shared";
import type { DisplayDriver } from "./displayDriver.js";
import { DdcCiDisplayDriver } from "./ddcCiDisplayDriver.js";
import { FakeDisplayDriver } from "./fakeDisplayDriver.js";
import { DisplayService } from "./displayService.js";

export type DisplayServiceOptions =
  | { enabled: false }
  | {
      enabled: true;
      driver: "ddc-ci" | "fake";
      connector: string;
      ddcBus?: string;
    };

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

  simulateExternal?(_power: "on" | "off"): void {
    // 無効時は何もしない
  }
}

/** 機能有効時の実サービスラッパー */
class ActiveDisplayService {
  readonly enabled = true as const;
  readonly #service: DisplayService;
  readonly #fakeDriver: FakeDisplayDriver | null;

  constructor(service: DisplayService, fakeDriver: FakeDisplayDriver | null) {
    this.#service = service;
    this.#fakeDriver = fakeDriver;
  }

  getStatus(): DisplayStatus {
    return this.#service.getStatus();
  }

  subscribe(cb: (event: DisplayEvent) => void): () => void {
    return this.#service.subscribe(cb);
  }

  async start(): Promise<void> {
    return this.#service.start();
  }

  stop(): void {
    this.#service.stop();
  }

  async setDesiredPower(desired: DesiredDisplayPower): Promise<void> {
    return this.#service.setDesiredPower(desired);
  }

  /** FakeDisplayDriver のシミュレーション（driver=fake の場合のみ有効） */
  simulateExternal(power: "on" | "off"): void {
    this.#fakeDriver?.simulateExternal(power);
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

  if (options.driver === "fake") {
    fakeDriver = new FakeDisplayDriver("on");
    driver = fakeDriver;
  } else {
    if (!options.ddcBus) {
      throw new Error("ASAMIRU_DDC_BUS is required when ASAMIRU_DISPLAY_DRIVER=ddc-ci (or default)");
    }
    driver = new DdcCiDisplayDriver({
      ddcBus: options.ddcBus,
      connector: options.connector,
    });
  }

  const service = new DisplayService(driver, {
    connector: options.connector,
    capabilities: DEFAULT_CAPABILITIES,
  });

  return new ActiveDisplayService(service, fakeDriver);
}
