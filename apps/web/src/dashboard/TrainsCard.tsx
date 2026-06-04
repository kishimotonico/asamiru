import type { TrainsData } from "./types";
import { DataUpdateWarning, RetryButton, dataCardStatus } from "./DataCardStatus";
import { DashboardCard } from "./DashboardCard";
import { StatusDot } from "./StatusDot";

export function TrainsCard({
  data,
  error,
  refreshing = false,
  className,
}: {
  data: TrainsData;
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
          <div className="rounded-lg bg-surface-muted p-5 text-ink-subtle sm:col-span-2">
            現在表示できる発車情報がありません
          </div>
        ) : null}
        {departureEntries.map(([direction, departures]) => (
          <div key={direction} className="min-w-0">
            <div className="mb-2 flex items-center gap-2 border-b border-border pb-3 text-[14px] tracking-[0.14em] text-ink-subtle">
              <span aria-hidden="true" className="h-4 w-1.5 rounded-sm bg-[var(--accent)]" />
              {direction}
            </div>
            {departures.map((departure, index) => {
              const delay = departure.delay ?? 0;
              const isSchedule = departure.source === "schedule";
              const barColor = isSchedule
                ? "bg-border-strong"
                : delay > 0
                  ? "bg-danger"
                  : "bg-success";
              return (
                <div
                  key={`${departure.time}-${departure.dest}-${index}`}
                  className={`flex gap-4 py-4 ${index < departures.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div className={`mt-1.5 w-1 shrink-0 self-stretch rounded-full ${barColor}`} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <div
                        className={`font-mono text-4xl font-medium tracking-[-0.02em] ${
                          isSchedule ? "text-ink-subtle" : delay > 0 ? "text-danger" : "text-ink"
                        }`}
                      >
                        {delay > 0 && departure.scheduled ? (
                          <span className="mr-1.5 text-2xl font-normal text-ink-subtle line-through">{departure.scheduled}</span>
                        ) : null}
                        {departure.time}
                      </div>
                      {delay > 0 ? (
                        <span className="rounded-full bg-danger-soft px-2.5 py-1 text-sm font-semibold text-danger">
                          +{delay}分
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2.5 text-lg text-ink-muted">
                      <span className="rounded bg-surface-muted px-2 py-0.5 text-sm font-semibold tracking-[0.04em]">
                        {departure.kind}
                      </span>
                      <span>{departure.dest}行</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <div className="mb-3 text-[13px] tracking-[0.14em] text-ink-subtle">路線運行情報</div>
        <LineStatusSection lines={data.lines} />
      </div>
    </DashboardCard>
  );
}

function LineStatusSection({ lines }: { lines: TrainsData["lines"] }) {
  if (lines.length === 0) {
    return <div className="rounded-lg bg-surface-muted p-4 text-sm text-ink-subtle">運行情報なし</div>;
  }

  const issueLines = lines.filter((l) => l.level !== "ok");
  const okLines = lines.filter((l) => l.level === "ok");

  if (issueLines.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-surface-muted px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink-muted">
          <StatusDot level="ok" />
          全線平常
        </span>
        <span className="text-xs text-ink-subtle">{lines.map((l) => l.name).join(" · ")}</span>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {issueLines.map((line) => (
        <div key={line.sourceUrl} className="rounded-lg bg-surface-muted p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusDot level={line.level} />
            <span className="font-semibold text-ink">{line.name}</span>
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
              {line.status}
            </span>
          </div>
          {line.note ? <div className="mt-1 text-sm leading-relaxed text-ink-muted">{line.note}</div> : null}
        </div>
      ))}
      {okLines.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 pt-0.5">
          {okLines.map((line) => (
            <span key={line.sourceUrl} className="flex items-center gap-1.5 text-sm text-ink-subtle">
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
