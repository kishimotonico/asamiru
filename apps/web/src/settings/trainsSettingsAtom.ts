import { atomWithStorage } from "jotai/utils";
import type { WatchedLine } from "@asamiru/shared";
import { hasOwn, isNumber, isRecord } from "../lib/guards";
import { RAIL_CATALOG } from "./catalog";
import type { TrainsSettings } from "./catalog";
import { mergedStorage } from "./mergedStorage";

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
 * mergedStorage は保存値をデフォルトより優先するため、同一オリジンに
 * 本番設定が残っているとデモへ実在駅・路線が混入しうる。
 * key を分けて本番／デモのストレージを完全分離する。
 */
export const TRAINS_SETTINGS_STORAGE_KEY =
  import.meta.env.VITE_DEMO_MODE === "true"
    ? "asamiru-trains-settings-demo"
    : "asamiru-trains-settings";

export function isTrainsSettings(value: unknown): value is Partial<TrainsSettings> {
  if (!isRecord(value)) return false;

  return (
    (!hasOwn(value, "boardingStation") || typeof value.boardingStation === "string") &&
    (!hasOwn(value, "displayCount") || isNumber(value.displayCount)) &&
    (!hasOwn(value, "watchedLines") ||
      (Array.isArray(value.watchedLines) && value.watchedLines.every(isWatchedLine)))
  );
}

export const trainsSettingsAtom = atomWithStorage(
  TRAINS_SETTINGS_STORAGE_KEY,
  RAIL_CATALOG.defaults,
  mergedStorage(RAIL_CATALOG.defaults),
  { getOnInit: true },
);

function isWatchedLine(value: unknown): value is WatchedLine {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.yahooUrl === "string"
  );
}
