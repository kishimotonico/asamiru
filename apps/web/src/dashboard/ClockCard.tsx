import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { DashboardCard } from "./DashboardCard";

type ClockCardProps = {
  className?: string;
  showSeconds?: boolean;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function ClockCard({ className, showSeconds = true }: ClockCardProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const dateText = `${now.getFullYear()} / ${now.getMonth() + 1} / ${now.getDate()} （${WEEKDAYS[now.getDay()]}）`;
  const hoursMinutes = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return (
    <DashboardCard className={cn("justify-center lg:self-start 2xl:self-stretch 2xl:min-h-[28rem]", className)}>
      <div className="pl-1 sm:pl-1.5 lg:pl-2 2xl:pl-3.5 text-2xl font-medium tracking-normal text-ink-muted sm:text-3xl lg:text-4xl 2xl:text-5xl">
        {dateText}
      </div>

      <div className="mt-6 flex flex-wrap items-baseline font-mono leading-none tracking-normal text-ink">
        <span className="text-7xl font-light sm:text-8xl lg:text-9xl 2xl:text-[13rem]">{hoursMinutes}</span>
        {showSeconds ? (
          <span className="ml-3 text-4xl font-light text-ink-muted sm:text-5xl lg:text-6xl 2xl:text-8xl">:{seconds}</span>
        ) : null}
      </div>
    </DashboardCard>
  );
}
