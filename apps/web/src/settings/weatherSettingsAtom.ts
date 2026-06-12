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

export const weatherSettingsAtom = atomWithStorage<WeatherSettings>(
  "asamiru-weather-settings",
  DEFAULT_WEATHER_SETTINGS,
  mergedStorage(DEFAULT_WEATHER_SETTINGS),
  { getOnInit: true },
);
