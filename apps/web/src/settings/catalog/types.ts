import type { WatchedLine } from "@asamiru/shared";
import type { SleepSettings } from "../../sleep/sleepSettingsAtom";

// ─── 設定型 ────────────────────────────────────────────────────────────────

export type TrainsSettings = {
  boardingStation: string;
  displayCount: number;
  watchedLines: WatchedLine[];
};

export type WeatherSettings = {
  lat: number;
  lon: number;
  locationName: string;
};

// ─── 鉄道カタログ ──────────────────────────────────────────────────────────

/**
 * 設定 UI が選択するマスタ集合。
 * 本番ビルドでは実在データ、デモビルドでは架空データが入り、
 * VITE_DEMO_MODE フラグによってビルド時に切り替わる。
 */
export type RailCatalog = {
  /** 乗車駅の候補 */
  stations: string[];
  /** 監視路線の候補（マスタ） */
  lines: WatchedLine[];
  /** 初期設定（乗車駅・表示本数・既定の監視路線） */
  defaults: TrainsSettings;
};

// ─── 天気カタログ ──────────────────────────────────────────────────────────

/**
 * 天気の初期設定。鉄道カタログと同様に、本番／デモで
 * VITE_DEMO_MODE フラグによってビルド時に切り替わる。
 */
export type WeatherCatalog = {
  /** 初期設定（座標・表示用の地名） */
  defaults: WeatherSettings;
};

// ─── スリープカタログ ──────────────────────────────────────────────────────

/**
 * スリープの初期設定。鉄道・天気カタログと同様に、本番／デモで
 * VITE_DEMO_MODE フラグによってビルド時に切り替わる。
 */
export type SleepCatalog = {
  /** 初期設定（自動スリープ・起床時間帯・手動起床時間） */
  defaults: SleepSettings;
};
