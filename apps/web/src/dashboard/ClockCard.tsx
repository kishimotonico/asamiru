import { useEffect, useState } from "react";
import { DashboardCard } from "./DashboardCard";

type ClockCardProps = {
  className?: string;
  showSeconds?: boolean;
  onSettingsClick?: () => void;
  onSleepClick?: () => void;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function ClockCard({ className, showSeconds = true, onSettingsClick, onSleepClick }: ClockCardProps) {
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
        <div className="flex items-center gap-1">
          {onSleepClick ? (
            <button
              onClick={onSleepClick}
              className="flex h-9 w-9 items-center justify-center rounded-md text-[#9aa0aa] hover:bg-[#f5f3ee] hover:text-[#1f2024]"
              aria-label="モニターをOFF"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
          ) : null}
          {onSettingsClick ? (
            <button
              onClick={onSettingsClick}
              className="flex h-9 w-9 items-center justify-center rounded-md text-[#9aa0aa] hover:bg-[#f5f3ee] hover:text-[#1f2024]"
              aria-label="設定"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          ) : null}
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
