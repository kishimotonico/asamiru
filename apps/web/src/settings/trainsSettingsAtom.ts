import { atomWithStorage } from "jotai/utils";
import type { WatchedLine } from "@asamiru/shared";
import { RAIL_CATALOG } from "./catalog";
import { serverSettingsStorage } from "./serverSettingsStorage";

export type { WatchedLine };
export type { TrainsSettings } from "./catalog";

// ─── 乗車駅候補 ────────────────────────────────────────────────────────────

/**
 * 設定画面で選択できる乗車駅の候補リスト。
 * 本番ビルドでは実在の駅、デモビルドでは架空の駅が入る。
 */
export const BOARDING_STATIONS = RAIL_CATALOG.stations;

// ─── 設定アトム ────────────────────────────────────────────────────────────

/**
 * localStorage key はビルドモードで分離する。
 * serverSettingsStorage は保存値をデフォルトより優先するため、同一オリジンに
 * 本番設定が残っているとデモへ実在駅・路線が混入しうる。
 * key を分けて本番／デモのストレージを完全分離する。
 */
const STORAGE_KEY =
  import.meta.env.VITE_DEMO_MODE === "true"
    ? "asamiru-trains-settings-demo"
    : "asamiru-trains-settings";

export const trainsSettingsAtom = atomWithStorage(
  STORAGE_KEY,
  RAIL_CATALOG.defaults,
  serverSettingsStorage(RAIL_CATALOG.defaults),
  { getOnInit: true },
);
