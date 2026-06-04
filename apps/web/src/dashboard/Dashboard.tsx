import type { CSSProperties } from "react";
import { AsyncCardBoundary } from "./AsyncCardBoundary";
import { CalendarCard } from "./CalendarCard";
import { ClockCard } from "./ClockCard";
import { WeatherErrorCard, WeatherLoadingCard } from "./WeatherCard";
import { TrainsErrorCard, TrainsLoadingCard } from "./TrainsCard";
import { WeatherDataCard } from "./WeatherDataCard";
import { TrainsDataCard } from "./TrainsDataCard";

type AccentStyle = CSSProperties & { "--accent": string };

type DashboardProps = {
  accent?: string;
};

export function Dashboard({ accent }: DashboardProps) {
  const style = accent ? ({ "--accent": accent } as AccentStyle) : undefined;

  return (
    <main
      className="min-h-screen bg-canvas px-4 py-5 font-sans text-ink sm:px-6 lg:px-10 xl:p-14"
      style={style}
    >
      <div className="mx-auto grid max-w-[1800px] gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start xl:gap-6 2xl:min-h-[calc(100vh-7rem)] 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)_minmax(0,7fr)] 2xl:grid-rows-[auto_1fr] 2xl:items-stretch">
        <ClockCard className="2xl:col-span-2" />
        <AsyncCardBoundary
          fallback={<TrainsLoadingCard className="2xl:row-span-2" />}
          errorFallback={(error, retry) => <TrainsErrorCard error={error} onRetry={retry} className="2xl:row-span-2" />}
        >
          <TrainsDataCard className="2xl:row-span-2" />
        </AsyncCardBoundary>
        <CalendarCard />
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
