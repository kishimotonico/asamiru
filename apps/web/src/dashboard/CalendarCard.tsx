import { DashboardCard } from "./DashboardCard";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

type Day = { date: number; isToday: boolean } | null;

function buildMonth(today: Date) {
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

export function CalendarCard({ className }: { className?: string }) {
  const { year, month, days } = buildMonth(new Date());

  return (
    <DashboardCard label="カレンダー" kicker={`${year} / ${month + 1}`} className={className}>
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
              className={`grid aspect-square place-items-center rounded text-[13px] ${
                day.isToday ? "bg-[var(--accent)] font-semibold text-white" : "text-ink"
              }`}
            >
              {day.date}
            </div>
          ),
        )}
      </div>
    </DashboardCard>
  );
}
