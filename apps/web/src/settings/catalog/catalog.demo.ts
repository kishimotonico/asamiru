import { DEMO_STATIONS, DEMO_LINES, DEMO_DEFAULTS } from "../../demo/railDemoData";
import type { RailCatalog, WeatherCatalog } from "./types";

// ─── デモ鉄道カタログ ──────────────────────────────────────────────────────

export const RAIL_CATALOG: RailCatalog = {
  stations: DEMO_STATIONS,
  lines: DEMO_LINES,
  defaults: DEMO_DEFAULTS,
};

// ─── デモ天気カタログ ──────────────────────────────────────────────────────

/**
 * 地名は架空（キヴォトス）だが、デモでも実 Open-Meteo API へ
 * パススルーするため座標は実在地点（東京）を指す。
 */
export const WEATHER_CATALOG: WeatherCatalog = {
  defaults: {
    lat: 35.6895,
    lon: 139.6917,
    locationName: "キヴォトス",
  },
};
