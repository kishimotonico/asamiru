import type { CalendarEvent } from "@asamiru/shared";
import { cn } from "../lib/cn";
import { DataUpdateWarning, RetryButton, dataCardStatus } from "./DataCardStatus";
import { DashboardCard } from "./DashboardCard";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

type Day = { date: number; isToday: boolean } | null;

export function buildMonth(today: Date) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Day[] = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: d, isToday: d === today.getDate() });
  }
  return { year, month, days };
}

type AgendaDay = {
  key: string;
  label: "今日" | "明日";
  events: Array<CalendarEvent & { time?: string }>;
};

export function buildCalendarAgenda(events: CalendarEvent[], now: Date): AgendaDay[] {
  const todayStart = startOfJstDay(now);
  return (["今日", "明日"] as const).map((label, index) => {
    const dayStart = new Date(todayStart.getTime() + index * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const key = jstDateKey(dayStart);
    return {
      key,
      label,
      events: events
        .filter((event) => occursOnDay(event, dayStart, dayEnd))
        .map((event) => ({ ...event, time: event.allDay ? undefined : jstTime(event.start) }))
        .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, "ja")),
    };
  });
}

export function CalendarCard({
  events = [],
  error,
  refreshing = false,
  className,
}: {
  events?: CalendarEvent[];
  error?: Error | null;
  refreshing?: boolean;
  className?: string;
}) {
  const now = new Date();
  const { year, month, days } = buildMonth(now);
  const agenda = buildCalendarAgenda(events, now);
  const hasEvents = agenda.some((day) => day.events.length > 0);

  return (
    <DashboardCard
      label="カレンダー"
      kicker={`${year} / ${month + 1}`}
      right={dataCardStatus(refreshing, error)}
      className={className}
    >
      {error ? <DataUpdateWarning error={error} /> : null}
      <div className="mt-3 grid grid-cols-7 gap-0.5 text-center text-[11px] text-ink-subtle">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1">
            {d}
          </div>
        ))}
        {days.map((day, i) =>
          day === null ? (
            <div key={`blank-${i}`} />
          ) : (
            <div
              key={day.date}
              className={cn(
                "grid aspect-square place-items-center rounded text-[13px]",
                day.isToday ? "bg-[var(--accent)] font-semibold text-white" : "text-ink",
              )}
            >
              {day.date}
            </div>
          ),
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col border-t border-border pt-3">
        <div className="text-[11px] tracking-[0.12em] text-ink-subtle">予定</div>
        {hasEvents ? (
          <div className="mt-2 grid gap-3">
            {agenda.map((day) =>
              day.events.length > 0 ? (
                <div key={day.key}>
                  <div className="mb-1.5 text-xs font-medium text-ink-muted">{day.label}</div>
                  <div className="grid gap-1.5">
                    {day.events.map((event, index) => (
                      <div key={`${event.start}-${event.title}-${index}`} className="flex min-w-0 items-baseline gap-2 text-sm">
                        {event.time ? (
                          <span className="w-10 shrink-0 font-mono text-xs text-ink-subtle">{event.time}</span>
                        ) : null}
                        <span className="min-w-0 truncate text-ink">{event.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-subtle">予定なし</div>
        )}
      </div>
    </DashboardCard>
  );
}

export function CalendarLoadingCard({ className }: { className?: string }) {
  return <CalendarStatusCard className={className} title="取得中" detail="カレンダーを読み込んでいます" />;
}

export function CalendarErrorCard({
  error,
  onRetry,
  className,
}: {
  error: string;
  onRetry?: () => void;
  className?: string;
}) {
  return <CalendarStatusCard className={className} title="取得失敗" detail={error} onRetry={onRetry} />;
}

function CalendarStatusCard({
  className,
  title,
  detail,
  onRetry,
}: {
  className?: string;
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <DashboardCard label="カレンダー" className={className}>
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

function occursOnDay(event: CalendarEvent, dayStart: Date, dayEnd: Date): boolean {
  const start = new Date(event.start);
  const end = new Date(event.end);
  if (event.allDay) {
    return start < dayEnd && end > dayStart;
  }
  return start >= dayStart && start < dayEnd;
}

function startOfJstDay(date: Date): Date {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 9 * 60 * 60 * 1000);
}

function jstDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function jstTime(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
