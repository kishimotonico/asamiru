import type { CSSProperties } from "react";
import type { DashboardData } from "../../types/dashboard";
import { DashboardCard } from "./DashboardCard";
import { StatusDot } from "./StatusDot";
import { WeatherIcon } from "./WeatherIcon";

type CardsDashboardProps = {
  data: DashboardData;
  accent?: string;
};

type AccentStyle = CSSProperties & {
  "--accent": string;
};

export function CardsDashboard({ data, accent = "#3a6b8a" }: CardsDashboardProps) {
  return (
    <main
      className="min-h-screen bg-[#eeece4] px-4 py-5 font-sans text-[#1f2024] sm:px-6 lg:px-10 xl:p-14"
      style={{ "--accent": accent } as AccentStyle}
    >
      <div className="mx-auto grid max-w-[1800px] gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start xl:gap-6 2xl:min-h-[calc(100vh-7rem)] 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)_minmax(0,7fr)] 2xl:grid-rows-[auto_1fr] 2xl:items-stretch">
        <ClockCard data={data.now} />
        <WeatherCard data={data.weather} className="2xl:row-span-2" />
        <TrainsCard data={data.trains} className="2xl:row-span-2" />
        <ScheduleCard data={data.schedule} />
      </div>
    </main>
  );
}

function ClockCard({ data }: { data: DashboardData["now"] }) {
  const paddedMonth = String(data.date.m).padStart(2, "0");
  const paddedDay = String(data.date.d).padStart(2, "0");

  return (
    <DashboardCard className="justify-between lg:self-start 2xl:self-stretch">
      <div className="flex justify-between gap-4 text-[15px] tracking-[0.18em] text-[#9aa0aa] sm:text-[17px]">
        <span>
          {data.date.y}.{paddedMonth}.{paddedDay}
        </span>
        <span>{data.date.weekday}</span>
      </div>

      <div className="mt-2 font-mono text-7xl font-light leading-none tracking-[-0.04em] text-[#1f2024] sm:text-8xl lg:text-9xl 2xl:text-[10.5rem]">
        {data.time}
      </div>

      {data.holiday ? (
        <div className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-[#fbece8] px-3.5 py-2 text-[15px] tracking-[0.04em] text-[#c14b3a]">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#c14b3a]" />
          祝日 · {data.holiday}
        </div>
      ) : null}
    </DashboardCard>
  );
}

function WeatherCard({
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
            <span className="text-7xl font-light leading-none tracking-[-0.03em] sm:text-8xl">{today.high}</span>
            <span className="text-3xl text-[#9aa0aa]">°/</span>
            <span className="text-4xl font-light text-[#5a5f69]">{today.low}°</span>
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
            <div className="text-[22px] font-medium">{hour.temp}°</div>
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
                <span className="text-2xl font-medium">{day.high}°</span>
                <span className="text-base text-[#9aa0aa]">/ {day.low}°</span>
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

function TrainsCard({
  data,
  className,
}: {
  data: DashboardData["trains"];
  className?: string;
}) {
  return (
    <DashboardCard label="交通" kicker={`${data.station} 駅`} className={className}>
      <div className="grid gap-6 sm:grid-cols-2">
        {Object.entries(data.departures).map(([direction, departures]) => (
          <div key={direction} className="min-w-0">
            <div className="mb-2 flex items-center gap-2 border-b border-[#e8e6df] pb-2.5 text-[13px] tracking-[0.14em] text-[#9aa0aa]">
              <span aria-hidden="true" className="h-3.5 w-1 rounded-sm bg-[var(--accent)]" />
              {direction}
            </div>
            {departures.map((departure, index) => (
              <div
                key={`${departure.time}-${departure.dest}-${index}`}
                className={index < departures.length - 1 ? "border-b border-[#e8e6df] py-3" : "py-3"}
              >
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <div
                    className={`font-mono text-3xl font-medium tracking-[-0.02em] ${
                      departure.delay > 0 ? "text-[#c14b3a]" : "text-[#1f2024]"
                    }`}
                  >
                    {departure.delay > 0 && departure.scheduled ? (
                      <span className="mr-1 text-xl font-normal text-[#9aa0aa] line-through">{departure.scheduled}</span>
                    ) : null}
                    {departure.time}
                  </div>
                  {departure.delay > 0 ? (
                    <span className="rounded-full bg-[#fbece8] px-2 py-1 text-xs font-semibold text-[#c14b3a]">
                      +{departure.delay}分
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center gap-2 text-base text-[#5a5f69]">
                  <span className="rounded bg-[#f0eee5] px-2 py-0.5 text-xs font-semibold tracking-[0.04em]">
                    {departure.kind}
                  </span>
                  <span>{departure.dest}行</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto pt-6">
        <div className="mb-3 border-t border-[#e8e6df] pt-5 text-[13px] tracking-[0.16em] text-[#9aa0aa]">運行状況</div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {data.lines.map((line) => (
            <div
              key={line.name}
              className={`flex min-w-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 ${
                line.level === "warn" ? "bg-[#fbece8]" : "bg-[#f6f5ef]"
              }`}
            >
              <StatusDot level={line.level} />
              <span className="shrink-0 text-[15px] font-semibold">{line.name}</span>
              <span
                className={`ml-auto truncate text-right text-[13px] ${
                  line.level === "warn" ? "font-semibold text-[#c14b3a]" : "text-[#5a5f69]"
                }`}
              >
                {line.status}
                {line.note ? <span className="font-normal text-[#9aa0aa]"> · {line.note}</span> : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}

function ScheduleCard({ data }: { data: DashboardData["schedule"] }) {
  const itemCount = data.today.length;

  return (
    <DashboardCard label="予定" kicker="Today" right={itemCount === 0 ? "予定なし" : `${itemCount} 件`}>
      {itemCount === 0 ? (
        <div className="mt-3 text-[22px] text-[#9aa0aa]">今日の予定はありません</div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {data.today.map((event) => (
            <div key={`${event.when ?? event.time}-${event.title}`} className="flex items-center gap-4">
              <span className="w-16 shrink-0 text-[17px] font-semibold tracking-[0.04em] text-[var(--accent)]">
                {event.when ?? event.time}
              </span>
              <span className="text-2xl font-medium leading-tight text-[#1f2024]">{event.title}</span>
            </div>
          ))}
        </div>
      )}

      {data.upcoming.length > 0 ? (
        <div className="mt-auto border-t border-dashed border-[#d8d5cc] pt-4">
          <div className="mb-2.5 text-xs tracking-[0.16em] text-[#9aa0aa]">このさき</div>
          {data.upcoming.map((event) => (
            <div key={`${event.date}-${event.title}`} className="flex items-baseline gap-3 py-1.5 text-[15px] text-[#5a5f69]">
              <span className="w-20 shrink-0 text-[#9aa0aa]">{event.date}</span>
              <span className="w-10 shrink-0 text-[#9aa0aa]">{event.when ?? event.time}</span>
              <span className="min-w-0 text-[#1f2024]">{event.title}</span>
            </div>
          ))}
        </div>
      ) : null}
    </DashboardCard>
  );
}
