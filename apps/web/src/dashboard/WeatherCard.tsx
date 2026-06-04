import type { WeatherData } from "./types";
import { DataUpdateWarning, RetryButton, dataCardStatus } from "./DataCardStatus";
import { DashboardCard } from "./DashboardCard";
import { WeatherIcon } from "./WeatherIcon";

export function WeatherCard({
  data,
  error,
  refreshing = false,
  className,
}: {
  data: WeatherData;
  error?: Error | null;
  refreshing?: boolean;
  className?: string;
}) {
  const today = data.today;

  return (
    <DashboardCard label="天気" kicker={data.location} right={dataCardStatus(refreshing, error)} className={className}>
      {error ? <DataUpdateWarning error={error} /> : null}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="grid h-32 w-32 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-surface-muted to-border text-ink sm:h-36 sm:w-36">
          <WeatherIcon
            kind={today.hourly[1]?.icon ?? "sun"}
            size={98}
            strokeWidth={1.2}
            className="translate-x-1.5 translate-y-0.5"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-base tracking-[0.06em] text-ink-subtle">今日</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[2.875rem] font-light leading-none tracking-normal sm:text-[4.75rem]">
              {today.high}
              <span className="ml-1 text-2xl text-ink-subtle sm:text-[1.875rem]">℃</span>
            </span>
            <span className="text-2xl text-ink-subtle sm:text-3xl">/</span>
            <span className="text-3xl font-light text-ink-muted sm:text-4xl">
              {today.low}
              <span className="ml-0.5 text-xl text-ink-subtle sm:text-2xl">℃</span>
            </span>
          </div>
          <div className="mt-2 text-lg text-ink-muted sm:text-xl">
            {today.label}
            <span className="ml-4 text-[var(--accent)]">降水 {today.pop}%</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-y-5 rounded-lg bg-surface-muted px-3 py-4 sm:grid-cols-6 sm:px-4">
        {today.hourly.map((hour) => (
          <div key={hour.h} className="flex flex-col items-center gap-1.5 text-center">
            <div className="text-sm tracking-[0.06em] text-ink-subtle">{hour.h}:00</div>
            <WeatherIcon kind={hour.icon} size={30} className="text-ink-muted" />
            <div className="text-[22px] font-medium">
              {hour.temp}
              <span className="ml-0.5 text-sm text-ink-subtle">℃</span>
            </div>
            <div className={`text-xs ${hour.pop > 20 ? "font-medium text-[var(--accent)]" : "text-ink-subtle"}`}>
              {hour.pop > 0 ? `${hour.pop}%` : "—"}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {[
          { ...data.tomorrow, heading: "明日" },
          { ...data.dayAfter, heading: "明後日" },
        ].map((day) => (
          <div key={day.heading} className="flex items-center gap-2.5 rounded-lg bg-surface-muted px-3 py-2.5">
            <WeatherIcon kind={day.icon} size={32} className="shrink-0 text-ink-muted" />
            <div className="min-w-0">
              <div className="truncate text-xs text-ink-subtle">
                {day.heading} · {day.weekday}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-medium">
                  {day.high}
                  <span className="ml-0.5 text-xs text-ink-subtle">℃</span>
                </span>
                <span className="text-sm text-ink-subtle">
                  / {day.low}
                  <span className="text-xs">℃</span>
                </span>
                <span className={`ml-0.5 text-[12px] ${day.pop > 20 ? "text-[var(--accent)]" : "text-ink-subtle"}`}>
                  {day.pop}%
                </span>
              </div>
              <div className="text-[12px] text-ink-muted">{day.label}</div>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

export function WeatherLoadingCard({ className }: { className?: string }) {
  return <WeatherStatusCard className={className} title="取得中" detail="天気データを読み込んでいます" />;
}

export function WeatherErrorCard({ error, onRetry, className }: { error: string; onRetry?: () => void; className?: string }) {
  return <WeatherStatusCard className={className} title="取得失敗" detail={error} onRetry={onRetry} />;
}

function WeatherStatusCard({ className, title, detail, onRetry }: { className?: string; title: string; detail: string; onRetry?: () => void }) {
  return (
    <DashboardCard label="天気" kicker="東京" className={className}>
      <div className="grid min-h-64 place-items-center rounded-lg bg-surface-muted p-6 text-center">
        <div>
          <div className="text-2xl font-semibold text-ink">{title}</div>
          <div className="mt-2 text-sm text-ink-subtle">{detail}</div>
          <RetryButton onRetry={onRetry} />
        </div>
      </div>
    </DashboardCard>
  );
}
