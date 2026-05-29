import { useEffect, useMemo, useState } from "react";
import { fetchTrains } from "../data/trains";
import { fetchWeather } from "../data/weather";
import { scheduleData } from "./scheduleData";
import type { DashboardData } from "./types";

type AsyncState<T> = {
  data?: T;
  error?: string;
  loading: boolean;
};

export type DashboardState = {
  weather: AsyncState<DashboardData["weather"]>;
  trains: AsyncState<DashboardData["trains"]>;
  schedule: DashboardData["schedule"];
};

const WEATHER_INTERVAL_MS = 10 * 60 * 1000;
const TRAINS_INTERVAL_MS = 60 * 1000;

export function useDashboardData(): DashboardState {
  const weather = usePolling(fetchWeather, WEATHER_INTERVAL_MS);
  const trains = usePolling(fetchTrains, TRAINS_INTERVAL_MS);

  return useMemo(
    () => ({
      weather,
      trains,
      schedule: scheduleData,
    }),
    [trains, weather],
  );
}

function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    async function load() {
      setState((current) => ({ ...current, loading: !current.data }));

      try {
        const data = await fetcher();
        if (!cancelled) {
          setState({ data, loading: false });
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            data: current.data,
            error: errorMessage(error),
            loading: false,
          }));
        }
      } finally {
        if (!cancelled) {
          timeoutId = window.setTimeout(load, intervalMs);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [fetcher, intervalMs]);

  return state;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
