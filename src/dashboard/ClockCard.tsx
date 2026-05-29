import { useEffect, useState } from "react";
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
    <DashboardCard className={`justify-between lg:self-start 2xl:self-stretch${className ? ` ${className}` : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="shrink-0 text-2xl font-medium tracking-normal text-[#5a5f69] sm:text-3xl lg:text-4xl">
          {dateText}
        </div>
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
