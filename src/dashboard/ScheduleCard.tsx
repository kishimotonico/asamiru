import type { DashboardData } from "./types";
import { DashboardCard } from "./DashboardCard";

export function ScheduleCard({ data, className }: { data: DashboardData["schedule"]; className?: string }) {
  const itemCount = data.today.length;

  return (
    <DashboardCard label="予定" kicker="Today" right={itemCount === 0 ? "予定なし" : `${itemCount} 件`} className={className}>
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
