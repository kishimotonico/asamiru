import { DashboardCard } from "./DashboardCard";

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

export function CalendarCard({ className }: { className?: string }) {
  const today = new Date();
  const calendar = buildCalendar(today);
  const monthLabel = `${calendar.year}年${calendar.month + 1}月`;

  return (
    <DashboardCard label="カレンダー" kicker="Calendar" className={className}>
      <div className="flex items-end justify-end">
        <div className="text-right">
          <div className="text-xl font-medium text-ink">{monthLabel}</div>
          <div className="mt-1 text-sm text-ink-subtle">{today.toLocaleDateString("ja-JP", { weekday: "long" })}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium tracking-[0.08em] text-ink-subtle">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday}>{weekday}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1.5">
        {calendar.days.map((day, index) =>
          day ? (
            <div
              key={`${calendar.year}-${calendar.month}-${day.date}`}
              className={`grid aspect-square min-h-9 place-items-center rounded-lg text-[15px] ${
                day.isToday
                  ? "bg-[var(--accent)] font-semibold text-white"
                  : "text-ink-muted"
              }`}
            >
              {day.date}
            </div>
          ) : (
            <div key={`blank-${index}`} className="aspect-square min-h-9" />
          ),
        )}
      </div>
    </DashboardCard>
  );
}

type CalendarDay = {
  date: number;
  isToday: boolean;
};

function buildCalendar(today: Date): { year: number; month: number; days: Array<CalendarDay | null> } {
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstDay = new Date(year, month, 1);
  const leadingBlankCount = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: Array<CalendarDay | null> = Array.from({ length: leadingBlankCount }, () => null);

  for (let date = 1; date <= daysInMonth; date += 1) {
    days.push({
      date,
      isToday: date === today.getDate(),
    });
  }

  return { year, month, days };
}
