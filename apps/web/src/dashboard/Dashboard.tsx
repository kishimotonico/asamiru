import type { CSSProperties } from "react";
import { useState } from "react";
import { AsyncCardBoundary } from "./AsyncCardBoundary";
import { CalendarCard } from "./CalendarCard";
import { ClockCard } from "./ClockCard";
import { WeatherErrorCard, WeatherLoadingCard } from "./WeatherCard";
import { TrainsErrorCard, TrainsLoadingCard } from "./TrainsCard";
import { WeatherDataCard } from "./WeatherDataCard";
import { TrainsDataCard } from "./TrainsDataCard";
import { SettingsModal } from "../settings/SettingsModal";

type AccentStyle = CSSProperties & { "--accent": string };

type DashboardProps = {
  accent?: string;
  onSleepClick?: () => void;
};

export function Dashboard({ accent = "#3a6b8a", onSleepClick }: DashboardProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <main
      className="min-h-screen bg-[#eeece4] px-4 py-5 font-sans text-[#1f2024] sm:px-6 lg:px-10 xl:p-14"
      style={{ "--accent": accent } as AccentStyle}
    >
      <div className="mx-auto grid max-w-[1800px] gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start xl:gap-6 2xl:min-h-[calc(100vh-7rem)] 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)_minmax(0,7fr)] 2xl:grid-rows-[auto_1fr] 2xl:items-stretch">
        <ClockCard
          className="2xl:col-span-2"
          onSettingsClick={() => setSettingsOpen(true)}
          onSleepClick={onSleepClick}
        />
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

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
