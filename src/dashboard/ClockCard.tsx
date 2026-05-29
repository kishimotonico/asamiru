import type { DashboardData } from "./types";
import { DashboardCard } from "./DashboardCard";

export function ClockCard({ data, className }: { data: DashboardData["now"]; className?: string }) {
  const paddedMonth = String(data.date.m).padStart(2, "0");
  const paddedDay = String(data.date.d).padStart(2, "0");

  return (
    <DashboardCard className={`justify-between lg:self-start 2xl:self-stretch${className ? ` ${className}` : ""}`}>
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
