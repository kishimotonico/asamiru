import { useCallback, useEffect, useState } from "react";
import type { ApiDebugEvent, ApiDebugMetrics } from "@asamiru/shared";
import { isTextInputTarget } from "../lib/dom";

const DEBUG_METRICS_ENDPOINT = `${import.meta.env.VITE_API_ORIGIN ?? ""}/api/debug/metrics`;

type Info = {
  w: number;
  h: number;
  dpr: number;
  scrollY: number;
};

function snapshot(): Info {
  return {
    w: window.innerWidth,
    h: window.innerHeight,
    dpr: window.devicePixelRatio,
    scrollY: Math.round(window.scrollY),
  };
}

function breakpoint(w: number): string {
  if (w >= 1536) return "2xl";
  if (w >= 1280) return "xl";
  if (w >= 1024) return "lg";
  if (w >= 768) return "md";
  if (w >= 640) return "sm";
  return "xs";
}

export function DebugOverlay() {
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState<Info>(snapshot);
  const [metrics, setMetrics] = useState<ApiDebugMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const refreshMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const response = await fetch(DEBUG_METRICS_ENDPOINT);
      if (!response.ok) {
        throw new Error(`debug metrics returned ${response.status}`);
      }
      const nextMetrics = (await response.json()) as ApiDebugMetrics;
      setMetrics(nextMetrics);
      setExpandedEventId((current) =>
        current && nextMetrics.events.some((event) => event.id === current) ? current : null,
      );
    } catch (error) {
      setMetricsError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    const update = () => setInfo(snapshot());
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "@") return;
      if (isTextInputTarget(event.target)) return;
      setVisible((current) => !current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!visible) {
      setAutoLoadAttempted(false);
      return;
    }
    if (!autoLoadAttempted && !metricsLoading) {
      setAutoLoadAttempted(true);
      void refreshMetrics();
    }
  }, [autoLoadAttempted, metricsLoading, refreshMetrics, visible]);

  if (!visible) {
    return (
      <div className="group fixed bottom-0 right-0 z-[9998] flex h-32 w-32 items-end justify-end p-4">
        <button
          type="button"
          onClick={() => setVisible(true)}
          className="rounded-md border border-[#111317]/10 bg-[#111317]/90 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100 focus:opacity-100"
        >
          Debug
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] max-h-[88vh] w-[min(1180px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-white/10 bg-[#111317]/95 text-white shadow-2xl backdrop-blur-sm"
      style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-base font-semibold tracking-[0.08em]">DEBUG PANEL</div>
          <div className="mt-1 text-xs text-white/40">
            @ で表示切替 / metrics {formatTime(metrics?.lastUpdatedAt)} / {metrics?.events.length ?? 0} events
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshMetrics()}
            disabled={metricsLoading}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#111317] hover:bg-white/90 disabled:opacity-40"
          >
            {metricsLoading ? "Loading..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white"
          >
            Hide
          </button>
        </div>
      </div>

      <div className="max-h-[calc(88vh-73px)] overflow-y-auto p-5">
        {metricsError ? (
          <div className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            metrics の取得に失敗しました。自動取得は再試行しません。必要なら Refresh を押してください。 {metricsError}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryTile title="Environment" value={`${info.w} x ${info.h}`} detail={`${breakpoint(info.w)} / DPR ${info.dpr.toFixed(1)} / scroll ${info.scrollY}`} />
          <SummaryTile title="Backend API" value={metrics?.totals.backendRequests ?? "-"} detail="backend request count" />
          <SummaryTile title="Upstream" value={metrics?.totals.upstreamRequests ?? "-"} detail="external API attempts" />
          <SummaryTile title="Cache" value={metrics ? `${metrics.totals.cacheHits} / ${metrics.totals.cacheMisses}` : "-"} detail="hit / miss" />
        </div>

        {metrics ? (
          <>
            <section className="mt-5 overflow-hidden rounded-lg border border-white/10">
              <div className="border-b border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-sm font-semibold tracking-[0.08em]">API STATS</div>
                <div className="mt-1 text-xs text-white/35">
                  外部APIへの負荷は Upstream と Cache Hit / Miss を見ます。Upstream は外部APIへ送信を試みた回数です。
                </div>
              </div>
              <div className="overflow-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-[#191c22] text-white/40">
                    <tr>
                      <th className="px-4 py-2 font-medium">API</th>
                      <th className="px-4 py-2 text-right font-medium">Backend</th>
                      <th className="px-4 py-2 text-right font-medium">Upstream</th>
                      <th className="px-4 py-2 text-right font-medium">Cache Hit</th>
                      <th className="px-4 py-2 text-right font-medium">Cache Miss</th>
                      <th className="px-4 py-2 text-right font-medium">Errors</th>
                      <th className="px-4 py-2 font-medium">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.apiStats.map((stat) => (
                      <tr key={stat.api} className="border-t border-white/[0.06] odd:bg-white/[0.02]">
                        <td className="px-4 py-2">
                          <div className="font-semibold text-white/80">{stat.label}</div>
                          <div className="text-[11px] text-white/35">{stat.api}</div>
                        </td>
                        <td className="px-4 py-2 text-right text-white/65">{stat.backendRequests}</td>
                        <td className="px-4 py-2 text-right text-white/80">{stat.upstreamRequests}</td>
                        <td className="px-4 py-2 text-right text-emerald-200/80">{stat.cacheHits}</td>
                        <td className="px-4 py-2 text-right text-amber-200/80">{stat.cacheMisses}</td>
                        <td className="px-4 py-2 text-right text-red-200/80">{stat.errors}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-white/45">{formatTime(stat.lastEventAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-5 overflow-hidden rounded-lg border border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-3">
                <div>
                  <div className="text-sm font-semibold tracking-[0.08em]">EVENT HISTORY</div>
                  <div className="mt-1 text-xs text-white/35">
                    1行はバックエンド内で発生したイベントです。フロントからのAPI 1件は backend_request と同じ correlation の関連イベントで追います。
                  </div>
                </div>
                <div className="text-xs text-white/35">{metrics.events.length} recent</div>
              </div>
              <div className="max-h-[52vh] overflow-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-[#191c22] text-white/40">
                    <tr>
                      <th className="w-24 px-4 py-2 font-medium">Time</th>
                      <th className="w-32 px-4 py-2 font-medium">Kind</th>
                      <th className="w-36 px-4 py-2 font-medium">API</th>
                      <th className="px-4 py-2 font-medium">Target</th>
                      <th className="w-20 px-4 py-2 text-right font-medium">Status</th>
                      <th className="w-24 px-4 py-2 text-right font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.events.map((event) => {
                      const expanded = expandedEventId === event.id;
                      const relatedEvents = event.correlationId
                        ? metrics.events.filter((candidate) => candidate.correlationId === event.correlationId)
                        : [];
                      return (
                        <EventRows
                          key={event.id}
                          event={event}
                          expanded={expanded}
                          relatedEvents={relatedEvents}
                          onToggle={() => setExpandedEventId((current) => (current === event.id ? null : event.id))}
                        />
                      );
                    })}
                    {metrics.events.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-white/35">
                          まだ backend debug event はありません。
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : metricsLoading ? (
          <div className="mt-5 rounded-lg border border-dashed border-white/15 px-5 py-10 text-center text-sm text-white/45">
            backend metrics を読み込んでいます...
          </div>
        ) : metricsError ? null : (
          <div className="mt-5 rounded-lg border border-dashed border-white/15 px-5 py-10 text-center">
            <div className="text-base font-semibold">Backend metrics are not loaded</div>
            <div className="mt-2 text-sm text-white/45">パネルを開いたタイミングで1回だけ自動取得します。再取得は Refresh を押してください。</div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-xs text-white/40">{detail}</div>
    </div>
  );
}

function EventRows({
  event,
  expanded,
  relatedEvents,
  onToggle,
}: {
  event: ApiDebugEvent;
  expanded: boolean;
  relatedEvents: ApiDebugEvent[];
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`cursor-pointer border-t border-white/[0.06] odd:bg-white/[0.02] hover:bg-white/[0.07] ${
          expanded ? "bg-white/[0.09]" : ""
        }`}
      >
        <td className="whitespace-nowrap px-4 py-2 text-white/55">{formatTime(event.at)}</td>
        <td className="px-4 py-2">
          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${kindClassName(event.kind)}`}>
            {kindLabel(event.kind)}
          </span>
        </td>
        <td className="px-4 py-2 text-white/55">{event.api}</td>
        <td className="min-w-0 px-4 py-2">
          <div className="truncate font-mono text-white/80">{event.target}</div>
          <div className="mt-0.5 truncate text-[11px] text-white/35">{event.summary}</div>
        </td>
        <td className="px-4 py-2 text-right text-white/55">{event.status ?? "-"}</td>
        <td className="px-4 py-2 text-right text-white/55">{formatDuration(event.durationMs)}</td>
      </tr>
      {expanded ? (
        <tr className="border-t border-white/[0.06] bg-black/15">
          <td colSpan={6} className="px-4 py-4">
            <EventDetail event={event} relatedEvents={relatedEvents} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function EventDetail({ event, relatedEvents }: { event: ApiDebugEvent; relatedEvents: ApiDebugEvent[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <dl className="grid gap-x-4 gap-y-2 text-xs md:grid-cols-[112px_minmax(0,1fr)_112px_minmax(0,1fr)]">
        <DetailRow label="ID" value={event.id} mono />
        <DetailRow label="Kind" value={kindLabel(event.kind)} />
        <DetailRow label="Target" value={event.target} mono />
        <DetailRow label="Time" value={formatDateTime(event.at)} />
        <DetailRow label="Correlation" value={event.correlationId ?? "-"} mono />
        <DetailRow label="Status" value={String(event.status ?? "-")} />
        <DetailRow label="Duration" value={formatDuration(event.durationMs)} />
        <DetailRow label="Summary" value={event.summary} />
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Detail</div>
          <pre className="max-h-48 overflow-auto rounded-md border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-white/65">
            {formatJson(event.detail ?? {})}
          </pre>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Related Events</div>
          <div className="mb-2 text-[11px] text-white/35">
            同じ backend request の中で発生した cache / upstream / calculation / error です。
          </div>
          <div className="max-h-48 space-y-1.5 overflow-auto">
            {relatedEvents.length > 0 ? (
              relatedEvents.map((related) => (
                <div key={related.id} className="rounded border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-white/35">{formatTime(related.at)}</span>
                  <span className="mx-2 text-white/20">/</span>
                  <span className="text-white/70">{kindLabel(related.kind)}</span>
                  <span className="mx-2 text-white/20">/</span>
                  <span className="font-mono text-white/55">{related.target}</span>
                </div>
              ))
            ) : (
              <div className="rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-white/35">関連イベントはありません。</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-white/35">{label}</dt>
      <dd className={`min-w-0 break-words text-white/70 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </>
  );
}

function formatTime(value: string | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(value: number | undefined): string {
  return typeof value === "number" ? `${value}ms` : "-";
}

function formatJson(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{\n  \"error\": \"detail could not be serialized\"\n}";
  }
}

function kindLabel(kind: ApiDebugEvent["kind"]): string {
  switch (kind) {
    case "backend_request":
      return "backend";
    case "upstream_request":
      return "upstream";
    case "cache_hit":
      return "cache_hit";
    case "cache_miss":
      return "cache_miss";
    case "calculation":
      return "calculation";
    case "error":
      return "error";
  }
}

function kindClassName(kind: ApiDebugEvent["kind"]): string {
  switch (kind) {
    case "backend_request":
      return "bg-sky-400/15 text-sky-200";
    case "upstream_request":
      return "bg-violet-400/15 text-violet-200";
    case "cache_hit":
      return "bg-emerald-400/15 text-emerald-200";
    case "cache_miss":
      return "bg-amber-400/15 text-amber-200";
    case "calculation":
      return "bg-white/10 text-white/65";
    case "error":
      return "bg-red-400/15 text-red-200";
  }
}

