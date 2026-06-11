import type { WatchedLine } from "@asamiru/shared";

// ─── 設定型 ────────────────────────────────────────────────────────────────

export type TrainsSettings = {
  boardingStation: string;
  displayCount: number;
  watchedLines: WatchedLine[];
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
