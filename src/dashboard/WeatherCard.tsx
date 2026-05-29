import type { DashboardData } from "./types";
import { DashboardCard } from "./DashboardCard";
import { WeatherIcon } from "./WeatherIcon";

export function WeatherCard({
  data,
  className,
}: {
  data: DashboardData["weather"];
  className?: string;
}) {
  const today = data.today;

  return (
    <DashboardCard label="天気" kicker={data.location} className={className}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="grid h-28 w-28 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#f3efe2] to-[#e8e4d3] text-[#1f2024] sm:h-32 sm:w-32">
          <WeatherIcon kind={today.hourly[1]?.icon ?? "sun"} size={84} strokeWidth={1.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base tracking-[0.06em] text-[#9aa0aa]">今日</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-7xl font-light leading-none tracking-normal sm:text-8xl">
              {today.high}
              <span className="ml-1 text-3xl text-[#9aa0aa] sm:text-4xl">℃</span>
            </span>
            <span className="text-3xl text-[#9aa0aa]">/</span>
            <span className="text-4xl font-light text-[#5a5f69]">
              {today.low}
              <span className="ml-0.5 text-2xl text-[#9aa0aa]">℃</span>
            </span>
          </div>
          <div className="mt-2 text-lg text-[#5a5f69] sm:text-xl">
            {today.label}
            <span className="ml-4 text-[var(--accent)]">降水 {today.pop}%</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-y-5 rounded-lg bg-[#f6f5ef] px-3 py-4 sm:grid-cols-6 sm:px-4">
        {today.hourly.map((hour) => (
          <div key={hour.h} className="flex flex-col items-center gap-1.5 text-center">
            <div className="text-sm tracking-[0.06em] text-[#9aa0aa]">{hour.h}:00</div>
            <WeatherIcon kind={hour.icon} size={30} className="text-[#5a5f69]" />
            <div className="text-[22px] font-medium">
              {hour.temp}
              <span className="ml-0.5 text-sm text-[#9aa0aa]">℃</span>
            </div>
            <div className={`text-xs ${hour.pop > 20 ? "font-medium text-[var(--accent)]" : "text-[#9aa0aa]"}`}>
              {hour.pop > 0 ? `${hour.pop}%` : "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:flex-1">
        {[
          { ...data.tomorrow, heading: "明日" },
          { ...data.dayAfter, heading: "明後日" },
        ].map((day) => (
          <div key={day.heading} className="flex items-center gap-3 rounded-lg bg-[#f9f8f3] p-4">
            <WeatherIcon kind={day.icon} size={42} className="shrink-0 text-[#5a5f69]" />
            <div className="min-w-0">
              <div className="truncate text-sm text-[#9aa0aa]">
                {day.heading} · {day.weekday}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-medium">
                  {day.high}
                  <span className="ml-0.5 text-base text-[#9aa0aa]">℃</span>
                </span>
                <span className="text-base text-[#9aa0aa]">
                  / {day.low}
                  <span className="text-sm">℃</span>
                </span>
                <span className={`ml-1 text-[13px] ${day.pop > 20 ? "text-[var(--accent)]" : "text-[#9aa0aa]"}`}>
                  {day.pop}%
                </span>
              </div>
              <div className="mt-0.5 text-[13px] text-[#5a5f69]">{day.label}</div>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
