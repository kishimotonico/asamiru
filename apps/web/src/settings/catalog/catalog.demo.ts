import { DEMO_STATIONS, DEMO_LINES, DEMO_DEFAULTS } from "../../demo/railDemoData";
import type { RailCatalog, SleepCatalog, WeatherCatalog } from "./types";

// ─── デモ鉄道カタログ ──────────────────────────────────────────────────────

export const RAIL_CATALOG: RailCatalog = {
  stations: DEMO_STATIONS,
  lines: DEMO_LINES,
  defaults: DEMO_DEFAULTS,
};

// ─── デモ天気カタログ ──────────────────────────────────────────────────────

/**
 * 地名は架空（シラトリ区）だが、デモでも実 Open-Meteo API へ
 * パススルーするため座標は実在地点（東京）を指す。
 */
export const WEATHER_CATALOG: WeatherCatalog = {
  defaults: {
    lat: 35.6895,
    lon: 139.6917,
    locationName: "シラトリ区",
  },
};

// ─── デモスリープカタログ ──────────────────────────────────────────────────

/**
 * デモは自動スリープを無効化し、開いた時刻に関わらずダッシュボードを表示する。
 */
export const SLEEP_CATALOG: SleepCatalog = {
  defaults: {
    enabled: false,
    windows: [{ id: "default-weekday-morning", days: [1, 2, 3, 4, 5], start: "06:00", end: "09:00" }],
    manualWakeDurationMin: 15,
  },
};
