import type { CSSProperties } from "react";
import type { DashboardData } from "./types";
import { ClockCard } from "./ClockCard";
import { WeatherCard } from "./WeatherCard";
import { TrainsCard } from "./TrainsCard";
import { ScheduleCard } from "./ScheduleCard";

type AccentStyle = CSSProperties & { "--accent": string };

type DashboardProps = {
  data: DashboardData;
  accent?: string;
};

export function Dashboard({ data, accent = "#3a6b8a" }: DashboardProps) {
  return (
    <main
      className="min-h-screen bg-[#eeece4] px-4 py-5 font-sans text-[#1f2024] sm:px-6 lg:px-10 xl:p-14"
      style={{ "--accent": accent } as AccentStyle}
    >
      <div className="mx-auto grid max-w-[1800px] gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start xl:gap-6 2xl:min-h-[calc(100vh-7rem)] 2xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)_minmax(0,7fr)] 2xl:grid-rows-[auto_1fr] 2xl:items-stretch">
        <ClockCard data={data.now} />
        <WeatherCard data={data.weather} />
        <TrainsCard data={data.trains} className="2xl:row-span-2" />
        <ScheduleCard data={data.schedule} className="2xl:col-span-2" />
      </div>
    </main>
  );
}
