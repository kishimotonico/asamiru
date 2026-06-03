import { useSuspenseQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { WeatherCard } from "./WeatherCard";
import { weatherQueryOptions } from "./dashboardQueries";
import { weatherSettingsAtom } from "../settings/weatherSettingsAtom";

/** 天気データを取得して WeatherCard に渡す接続コンポーネント。 */
export function WeatherDataCard({ className }: { className?: string }) {
  const settings = useAtomValue(weatherSettingsAtom);
  const weather = useSuspenseQuery(weatherQueryOptions(settings));
  return (
    <WeatherCard
      data={weather.data}
      error={weather.error}
      refreshing={weather.isFetching}
      className={className}
    />
  );
}
