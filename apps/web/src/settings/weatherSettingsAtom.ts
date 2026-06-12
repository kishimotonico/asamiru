import { atomWithStorage } from "jotai/utils";
import { mergedStorage } from "./mergedStorage";

export type WeatherSettings = {
  lat: number;
  lon: number;
  locationName: string;
};

const DEFAULT_WEATHER_SETTINGS: WeatherSettings = {
  lat: 35.6895,
  lon: 139.6917,
  locationName: "東京",
};

export const WEATHER_SETTINGS_STORAGE_KEY = "asamiru-weather-settings";

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
  DEFAULT_WEATHER_SETTINGS,
  mergedStorage(DEFAULT_WEATHER_SETTINGS),
  { getOnInit: true },
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
