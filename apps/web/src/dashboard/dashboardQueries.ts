import { queryOptions } from "@tanstack/react-query";
import type { WatchedLine } from "@asamiru/shared";
import { fetchDepartures } from "../data/departures";
import { fetchLineStatus } from "../data/lineStatus";
import { fetchWeather } from "../data/weather";
import type { WeatherSettings } from "../settings/weatherSettingsAtom";
import type { TrainsSettings } from "../settings/trainsSettingsAtom";

const WEATHER_INTERVAL_MS = 10 * 60 * 1000;
const DEPARTURES_INTERVAL_MS = 90 * 1000;
const LINE_STATUS_INTERVAL_MS = 5 * 60 * 1000;

export function weatherQueryOptions(settings: WeatherSettings) {
  return queryOptions({
    queryKey: ["dashboard", "weather", { lat: settings.lat, lon: settings.lon }],
    queryFn: ({ signal }) => fetchWeather({ ...settings, signal }),
    staleTime: WEATHER_INTERVAL_MS,
    refetchInterval: WEATHER_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}

export function lineStatusQueryOptions(watchedLines: WatchedLine[]) {
  return queryOptions({
    queryKey: ["dashboard", "line-status", watchedLines.map((l) => l.yahooUrl)],
    queryFn: ({ signal }) => fetchLineStatus(watchedLines, { signal }),
    staleTime: LINE_STATUS_INTERVAL_MS,
    refetchInterval: LINE_STATUS_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}

export function departuresQueryOptions(settings: TrainsSettings) {
  return queryOptions({
    queryKey: ["dashboard", "departures", { boardingStation: settings.boardingStation, displayCount: settings.displayCount }],
    queryFn: ({ signal }) =>
      fetchDepartures({
        boardingStation: settings.boardingStation,
        displayCount: settings.displayCount,
        signal,
      }),
    staleTime: DEPARTURES_INTERVAL_MS,
    refetchInterval: DEPARTURES_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}
