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

export const weatherSettingsAtom = atomWithStorage<WeatherSettings>(
  WEATHER_SETTINGS_STORAGE_KEY,
  DEFAULT_WEATHER_SETTINGS,
  mergedStorage(DEFAULT_WEATHER_SETTINGS),
  { getOnInit: true },
);
