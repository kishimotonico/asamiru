import { atomWithStorage } from "jotai/utils";

export type WeatherSettings = {
  lat: number;
  lon: number;
  locationName: string;
};

export const weatherSettingsAtom = atomWithStorage<WeatherSettings>("asamiru-weather-settings", {
  lat: 35.6895,
  lon: 139.6917,
  locationName: "東京",
});
