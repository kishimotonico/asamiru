import type { CSSProperties } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AsyncCardBoundary } from "./AsyncCardBoundary";
import { ClockCard } from "./ClockCard";
import { WeatherCard, WeatherErrorCard, WeatherLoadingCard } from "./WeatherCard";
import { TrainsCard, TrainsErrorCard, TrainsLoadingCard } from "./TrainsCard";
import { ScheduleCard } from "./ScheduleCard";
import { trainStatusQueryOptions, trainsQueryOptions, weatherQueryOptions } from "./dashboardQueries";
import { scheduleData } from "./scheduleData";

type AccentStyle = CSSProperties & { "--accent": string };

type DashboardProps = {
  accent?: string;
};

export function Dashboard({ accent = "#3a6b8a" }: DashboardProps) {
  return (
    <main
      className="min-h-screen bg-[#eeece4] px-4 py-5 font-sans text-[#1f2024] sm:px-6 lg:px-10 xl:p-14"
      style={{ "--accent": accent } as AccentStyle}
    >
      <div className="mx-auto grid max-w-[1800px] gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start xl:gap-6 2xl:min-h-[calc(100vh-7rem)] 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)_minmax(0,7fr)] 2xl:grid-rows-[auto_1fr] 2xl:items-stretch">
        <ClockCard className="2xl:col-span-2" />
        <AsyncCardBoundary
          fallback={<TrainsLoadingCard className="2xl:row-span-2" />}
          errorFallback={(error, retry) => <TrainsErrorCard error={error} onRetry={retry} className="2xl:row-span-2" />}
        >
          <TrainsDataCard className="2xl:row-span-2" />
        </AsyncCardBoundary>
        <ScheduleCard data={scheduleData} />
        <AsyncCardBoundary
          fallback={<WeatherLoadingCard />}
          errorFallback={(error, retry) => <WeatherErrorCard error={error} onRetry={retry} />}
        >
          <WeatherDataCard />
        </AsyncCardBoundary>
      </div>
    </main>
  );
}

function WeatherDataCard({ className }: { className?: string }) {
  const weather = useSuspenseQuery(weatherQueryOptions());
  return (
    <WeatherCard
      data={weather.data}
      error={weather.error}
      refreshing={weather.isFetching}
      className={className}
    />
  );
}

function TrainsDataCard({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const trains = useSuspenseQuery(trainsQueryOptions(queryClient));
  const trainStatus = useSuspenseQuery(trainStatusQueryOptions());
  return (
    <TrainsCard
      data={{ ...trains.data, lines: trainStatus.data.lines }}
      error={trains.error ?? trainStatus.error}
      refreshing={trains.isFetching || trainStatus.isFetching}
      className={className}
    />
  );
}
