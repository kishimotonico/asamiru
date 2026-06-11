import type { CSSProperties } from "react";
import { AsyncCardBoundary } from "./AsyncCardBoundary";
import { CalendarErrorCard, CalendarLoadingCard } from "./CalendarCard";
import { ClockCard } from "./ClockCard";
import { WeatherErrorCard, WeatherLoadingCard } from "./WeatherCard";
import { TrainsErrorCard, TrainsLoadingCard } from "./TrainsCard";
import { WeatherDataCard } from "./WeatherDataCard";
import { TrainsDataCard } from "./TrainsDataCard";
import { CalendarDataCard } from "./CalendarDataCard";

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
      <div className="mx-auto grid max-w-[1800px] gap-4 sm:gap-5 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start xl:gap-6 2xl:min-h-[calc(100vh-7rem)] 2xl:items-stretch">
        <ClockCard />
        <AsyncCardBoundary
          fallback={<TrainsLoadingCard className="lg:row-span-2" />}
          errorFallback={(error, retry) => <TrainsErrorCard error={error} onRetry={retry} className="lg:row-span-2" />}
        >
          <TrainsDataCard className="lg:row-span-2" />
        </AsyncCardBoundary>
        <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:gap-6 2xl:grid-cols-[3fr_2fr]">
          <AsyncCardBoundary
            fallback={<WeatherLoadingCard />}
            errorFallback={(error, retry) => <WeatherErrorCard error={error} onRetry={retry} />}
          >
            <WeatherDataCard />
          </AsyncCardBoundary>
          <AsyncCardBoundary
            fallback={<CalendarLoadingCard />}
            errorFallback={(error, retry) => <CalendarErrorCard error={error} onRetry={retry} />}
          >
            <CalendarDataCard />
          </AsyncCardBoundary>
        </div>
      </div>
    </main>
  );
}
