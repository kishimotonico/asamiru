import type { DashboardData } from "./types";
import { DashboardCard } from "./DashboardCard";

type ClockCardProps = {
  data: DashboardData["now"];
  className?: string;
  showSeconds?: boolean;
};

function splitTime(time: string) {
  const [hours = "00", minutes = "00", seconds = "00"] = time.split(":");
  return {
    hoursMinutes: `${hours}:${minutes}`,
    seconds,
  };
}

export function ClockCard({ data, className, showSeconds = true }: ClockCardProps) {
  const dateText = `${data.date.y} / ${data.date.m} / ${data.date.d} （${data.date.weekday}）`;
  const { hoursMinutes, seconds } = splitTime(data.time);

  return (
    <DashboardCard className={`justify-between lg:self-start 2xl:self-stretch${className ? ` ${className}` : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="shrink-0 text-2xl font-medium tracking-normal text-[#5a5f69] sm:text-3xl lg:text-4xl">
          {dateText}
        </div>
        {data.holiday ? (
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#fbece8] px-3 py-1.5 text-[13px] tracking-[0.04em] text-[#c14b3a] sm:text-sm">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#c14b3a]" />
            祝日 · {data.holiday}
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex items-baseline font-mono leading-none tracking-normal text-[#1f2024]">
        <span className="text-7xl font-light sm:text-8xl lg:text-9xl 2xl:text-[10.5rem]">{hoursMinutes}</span>
        {showSeconds ? (
          <span className="ml-3 text-4xl font-light text-[#5a5f69] sm:text-5xl lg:text-6xl 2xl:text-7xl">:{seconds}</span>
        ) : null}
      </div>
    </DashboardCard>
  );
}
