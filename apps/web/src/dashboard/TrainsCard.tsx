import type { DashboardData } from "./types";
import { DataUpdateWarning, RetryButton, dataCardStatus } from "./DataCardStatus";
import { DashboardCard } from "./DashboardCard";
import { StatusDot } from "./StatusDot";

export function TrainsCard({
  data,
  error,
  refreshing = false,
  className,
}: {
  data: DashboardData["trains"];
  error?: Error | null;
  refreshing?: boolean;
  className?: string;
}) {
  const departureEntries = Object.entries(data.departures);

  return (
    <DashboardCard label="交通" kicker={`${data.station} 駅`} right={dataCardStatus(refreshing, error)} className={className}>
      {error ? <DataUpdateWarning error={error} /> : null}
      <div className="grid gap-6 sm:grid-cols-2">
        {departureEntries.length === 0 ? (
          <div className="rounded-lg bg-[#f6f5ef] p-5 text-[#9aa0aa] sm:col-span-2">
            現在表示できる発車情報がありません
          </div>
        ) : null}
        {departureEntries.map(([direction, departures]) => (
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

      <div className="mt-6 border-t border-[#e8e6df] pt-5">
        <div className="mb-3 text-[13px] tracking-[0.14em] text-[#9aa0aa]">路線運行情報</div>
        <LineStatusSection lines={data.lines} />
      </div>
    </DashboardCard>
  );
}

function LineStatusSection({ lines }: { lines: DashboardData["trains"]["lines"] }) {
  if (lines.length === 0) {
    return <div className="rounded-lg bg-[#f6f5ef] p-4 text-sm text-[#9aa0aa]">運行情報なし</div>;
  }

  const issueLines = lines.filter((l) => l.level !== "ok");
  const okLines = lines.filter((l) => l.level === "ok");

  if (issueLines.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-[#f6f5ef] px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-medium text-[#5a5f69]">
          <StatusDot level="ok" />
          全線平常
        </span>
        <span className="text-xs text-[#9aa0aa]">{lines.map((l) => l.name).join(" · ")}</span>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {issueLines.map((line) => (
        <div key={line.sourceUrl} className="rounded-lg bg-[#f9f8f3] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusDot level={line.level} />
            <span className="font-semibold text-[#1f2024]">{line.name}</span>
            <span className="rounded-full bg-[#fbece8] px-2 py-0.5 text-xs font-semibold text-[#c14b3a]">
              {line.status}
            </span>
          </div>
          {line.note ? <div className="mt-1 text-sm leading-relaxed text-[#5a5f69]">{line.note}</div> : null}
        </div>
      ))}
      {okLines.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-0.5">
          {okLines.map((line) => (
            <span key={line.sourceUrl} className="flex items-center gap-1.5 text-sm text-[#9aa0aa]">
              <StatusDot level="ok" />
              {line.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrainsLoadingCard({ className }: { className?: string }) {
  return <TrainsStatusCard className={className} title="取得中" detail="列車情報を読み込んでいます" />;
}

export function TrainsErrorCard({ error, onRetry, className }: { error: string; onRetry?: () => void; className?: string }) {
  return <TrainsStatusCard className={className} title="取得失敗" detail={error} onRetry={onRetry} />;
}

function TrainsStatusCard({ className, title, detail, onRetry }: { className?: string; title: string; detail: string; onRetry?: () => void }) {
  return (
    <DashboardCard label="交通" kicker="京王線" className={className}>
      <div className="grid min-h-64 place-items-center rounded-lg bg-[#f6f5ef] p-6 text-center">
        <div>
          <div className="text-2xl font-semibold text-[#1f2024]">{title}</div>
          <div className="mt-2 text-sm text-[#9aa0aa]">{detail}</div>
          <RetryButton onRetry={onRetry} />
        </div>
      </div>
    </DashboardCard>
  );
}
