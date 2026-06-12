import { atomWithStorage } from "jotai/utils";
import { hasOwn, isNumber, isRecord } from "../lib/guards";
import { WEATHER_CATALOG } from "./catalog";
import type { WeatherSettings } from "./catalog";
import { mergedStorage } from "./mergedStorage";

export type { WeatherSettings } from "./catalog";

/**
 * localStorage key はビルドモードで分離する。
 * mergedStorage は保存値をデフォルトより優先するため、同一オリジンに
 * 本番設定が残っているとデモへ実在の地名・座標が混入しうる。
 * key を分けて本番／デモのストレージを完全分離する。
 */
export const WEATHER_SETTINGS_STORAGE_KEY =
  import.meta.env.VITE_DEMO_MODE === "true"
    ? "asamiru-weather-settings-demo"
    : "asamiru-weather-settings";

export function isWeatherSettings(value: unknown): value is Partial<WeatherSettings> {
  if (!isRecord(value)) return false;

  return (
    (!hasOwn(value, "lat") || isNumber(value.lat)) &&
    (!hasOwn(value, "lon") || isNumber(value.lon)) &&
    (!hasOwn(value, "locationName") || typeof value.locationName === "string")
  );
}

export const weatherSettingsAtom = atomWithStorage<WeatherSettings>(
  WEATHER_SETTINGS_STORAGE_KEY,
  WEATHER_CATALOG.defaults,
  mergedStorage(WEATHER_CATALOG.defaults),
  { getOnInit: true },
);
