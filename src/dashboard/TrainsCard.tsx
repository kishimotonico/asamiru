import type { DashboardData } from "./types";
import { DashboardCard } from "./DashboardCard";
import { StatusDot } from "./StatusDot";

export function TrainsCard({
  data,
  className,
}: {
  data: DashboardData["trains"];
  className?: string;
}) {
  return (
    <DashboardCard label="交通" kicker={`${data.station} 駅`} className={className}>
      <div className="grid gap-6 sm:grid-cols-2">
        {Object.entries(data.departures).map(([direction, departures]) => (
          <div key={direction} className="min-w-0">
            <div className="mb-2 flex items-center gap-2 border-b border-[#e8e6df] pb-2.5 text-[13px] tracking-[0.14em] text-[#9aa0aa]">
              <span aria-hidden="true" className="h-3.5 w-1 rounded-sm bg-[var(--accent)]" />
              {direction}
            </div>
            {departures.map((departure, index) => (
              <div
                key={`${departure.time}-${departure.dest}-${index}`}
                className={index < departures.length - 1 ? "border-b border-[#e8e6df] py-3" : "py-3"}
              >
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <div
                    className={`font-mono text-3xl font-medium tracking-[-0.02em] ${
                      departure.delay > 0 ? "text-[#c14b3a]" : "text-[#1f2024]"
                    }`}
                  >
                    {departure.delay > 0 && departure.scheduled ? (
                      <span className="mr-1 text-xl font-normal text-[#9aa0aa] line-through">{departure.scheduled}</span>
                    ) : null}
                    {departure.time}
                  </div>
                  {departure.delay > 0 ? (
                    <span className="rounded-full bg-[#fbece8] px-2 py-1 text-xs font-semibold text-[#c14b3a]">
                      +{departure.delay}分
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center gap-2 text-base text-[#5a5f69]">
                  <span className="rounded bg-[#f0eee5] px-2 py-0.5 text-xs font-semibold tracking-[0.04em]">
                    {departure.kind}
                  </span>
                  <span>{departure.dest}行</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-auto pt-6">
        <div className="mb-3 border-t border-[#e8e6df] pt-5 text-[13px] tracking-[0.16em] text-[#9aa0aa]">運行状況</div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {data.lines.map((line) => (
            <div
              key={line.name}
              className={`flex min-w-0 items-center gap-2.5 rounded-lg px-3.5 py-2.5 ${
                line.level === "warn" ? "bg-[#fbece8]" : "bg-[#f6f5ef]"
              }`}
            >
              <StatusDot level={line.level} />
              <span className="shrink-0 text-[15px] font-semibold">{line.name}</span>
              <span
                className={`ml-auto truncate text-right text-[13px] ${
                  line.level === "warn" ? "font-semibold text-[#c14b3a]" : "text-[#5a5f69]"
                }`}
              >
                {line.status}
                {line.note ? <span className="font-normal text-[#9aa0aa]"> · {line.note}</span> : null}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
