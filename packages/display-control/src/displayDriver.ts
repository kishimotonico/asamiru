import type { DisplayConnection, DisplayPower } from "@asamiru/shared";

export type ConnectionResult =
  | { connection: DisplayConnection; error: null }
  | { connection: "unknown"; error: string };

export type PowerResult =
  | { power: DisplayPower; error: null }
  | { power: "unknown"; error: string };

/** ハードウェアアクセスを抽象化するドライバーインターフェース */
export interface DisplayDriver {
  /** DRM sysfs から接続状態を読む */
  readConnection(): Promise<ConnectionResult>;
  /** DDC/CI D6 から電源状態を読む */
  readPower(): Promise<PowerResult>;
  /** モニターを待機させる（D6=05） */
  setStandby(): Promise<void>;
  /** モニターを復帰させる（D6=01） */
  setPowerOn(): Promise<void>;
}
