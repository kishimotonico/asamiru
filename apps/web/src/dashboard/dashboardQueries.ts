import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { WatchedLine } from "@asamiru/shared";
import { fetchTrainStatus } from "../data/trainStatus";
import { fetchTrainDia, fetchTrains } from "../data/trains";
import { fetchWeather } from "../data/weather";
import type { WeatherSettings } from "../settings/weatherSettingsAtom";
import type { TrainsSettings } from "../settings/trainsSettingsAtom";

const WEATHER_INTERVAL_MS = 10 * 60 * 1000;
const TRAINS_INTERVAL_MS = 90 * 1000;
const TRAIN_STATUS_INTERVAL_MS = 2 * 60 * 1000;
const DIA_TTL_MS = 12 * 60 * 60 * 1000;

export function weatherQueryOptions(settings: WeatherSettings) {
  return queryOptions({
    queryKey: ["dashboard", "weather", { lat: settings.lat, lon: settings.lon }],
    queryFn: ({ signal }) => fetchWeather({ ...settings, signal }),
    staleTime: WEATHER_INTERVAL_MS,
    refetchInterval: WEATHER_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}

export function trainStatusQueryOptions(watchedLines: WatchedLine[]) {
  return queryOptions({
    queryKey: ["dashboard", "train-status", watchedLines.map((l) => l.yahooUrl)],
    queryFn: ({ signal }) => fetchTrainStatus(watchedLines, { signal }),
    staleTime: TRAIN_STATUS_INTERVAL_MS,
    refetchInterval: TRAIN_STATUS_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}

export function trainsQueryOptions(queryClient: QueryClient, settings: TrainsSettings) {
  return queryOptions({
    queryKey: ["dashboard", "trains", { boardingStation: settings.boardingStation }],
    queryFn: ({ signal }) =>
      fetchTrains({
        boardingStation: settings.boardingStation,
        signal,
        loadDia: (trainId) => queryClient.fetchQuery(trainDiaQueryOptions(trainId)),
      }),
    staleTime: TRAINS_INTERVAL_MS,
    refetchInterval: TRAINS_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}

function trainDiaQueryOptions(trainId: string) {
  return queryOptions({
    queryKey: ["keio", "dia", trainId],
    queryFn: ({ signal }) => fetchTrainDia(trainId, { signal }),
    staleTime: DIA_TTL_MS,
    gcTime: DIA_TTL_MS,
  });
}
