import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiDebugEvent, ApiDebugMetrics } from "@asamiru/shared";

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
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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
      setLoadedOnce(true);
      setSelectedEventId((current) =>
        current && nextMetrics.events.some((event) => event.id === current) ? current : nextMetrics.events[0]?.id ?? null,
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
    if (visible && !loadedOnce && !metricsLoading) {
      void refreshMetrics();
    }
  }, [loadedOnce, metricsLoading, refreshMetrics, visible]);

  const selectedEvent = useMemo(
    () => metrics?.events.find((event) => event.id === selectedEventId) ?? metrics?.events[0] ?? null,
    [metrics, selectedEventId],
  );
  const relatedEvents = useMemo(() => {
    if (!metrics || !selectedEvent?.correlationId) return [];
    return metrics.events.filter((event) => event.correlationId === selectedEvent.correlationId);
  }, [metrics, selectedEvent]);

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
      className="fixed bottom-4 right-4 z-[9999] max-h-[88vh] w-[min(1120px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-white/10 bg-[#111317]/95 text-white shadow-2xl backdrop-blur-sm"
      style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-base font-semibold tracking-[0.08em]">DEBUG PANEL</div>
          <div className="mt-1 text-xs text-white/40">
            Toggle @ / metrics {formatTime(metrics?.lastUpdatedAt)} / {metrics?.events.length ?? 0} events
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
            {metricsError}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          <SummaryTile title="Environment" value={`${info.w} x ${info.h}`} detail={`${breakpoint(info.w)} / DPR ${info.dpr.toFixed(1)} / scroll ${info.scrollY}`} />
          <SummaryTile title="Backend API" value={metrics?.totals.backendRequests ?? "-"} detail="received requests" />
          <SummaryTile title="Upstream" value={metrics?.totals.upstreamRequests ?? "-"} detail="external API requests" />
          <SummaryTile title="Cache" value={metrics ? `${metrics.totals.cacheHits} / ${metrics.totals.cacheMisses}` : "-"} detail="hit / miss" />
        </div>

        {metrics ? (
          <>
            <section className="mt-5 overflow-hidden rounded-lg border border-white/10">
              <div className="border-b border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-sm font-semibold tracking-[0.08em]">API STATS</div>
                <div className="mt-1 text-xs text-white/35">External load is primarily visible in the Upstream and Cache columns.</div>
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

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
              <section className="overflow-hidden rounded-lg border border-white/10">
                <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold tracking-[0.08em]">EVENT HISTORY</div>
                    <div className="mt-1 text-xs text-white/35">
                      Backend request / upstream / cache / calculation / error. Click a row for details.
                    </div>
                  </div>
                  <div className="text-xs text-white/35">{metrics.events.length} recent</div>
                </div>
                <div className="max-h-[44vh] overflow-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 bg-[#191c22] text-white/40">
                      <tr>
                        <th className="w-24 px-4 py-2 font-medium">Time</th>
                        <th className="w-36 px-4 py-2 font-medium">Kind</th>
                        <th className="w-36 px-4 py-2 font-medium">API</th>
                        <th className="px-4 py-2 font-medium">Summary</th>
                        <th className="w-20 px-4 py-2 text-right font-medium">Status</th>
                        <th className="w-24 px-4 py-2 text-right font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.events.map((event) => (
                        <tr
                          key={event.id}
                          onClick={() => setSelectedEventId(event.id)}
                          className={`cursor-pointer border-t border-white/[0.06] odd:bg-white/[0.02] hover:bg-white/[0.07] ${
                            selectedEvent?.id === event.id ? "bg-white/[0.09]" : ""
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-2 text-white/55">{formatTime(event.at)}</td>
                          <td className="px-4 py-2">
                            <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${kindClassName(event.kind)}`}>
                              {kindLabel(event.kind)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-white/55">{event.api}</td>
                          <td className="max-w-[320px] truncate px-4 py-2 text-white/80">{event.summary}</td>
                          <td className="px-4 py-2 text-right text-white/55">{event.status ?? "-"}</td>
                          <td className="px-4 py-2 text-right text-white/55">{formatDuration(event.durationMs)}</td>
                        </tr>
                      ))}
                      {metrics.events.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-white/35">
                            No backend debug events yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <EventDetail event={selectedEvent} relatedEvents={relatedEvents} />
            </div>
          </>
        ) : metricsLoading ? (
          <div className="mt-5 rounded-lg border border-dashed border-white/15 px-5 py-10 text-center text-sm text-white/45">
            Loading backend debug metrics...
          </div>
        ) : metricsError ? null : (
          <div className="mt-5 rounded-lg border border-dashed border-white/15 px-5 py-10 text-center">
            <div className="text-base font-semibold">Backend metrics are not loaded</div>
            <div className="mt-2 text-sm text-white/45">Open the panel or press Refresh to load the current counters and request history.</div>
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

function EventDetail({ event, relatedEvents }: { event: ApiDebugEvent | null; relatedEvents: ApiDebugEvent[] }) {
  if (!event) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5 text-sm text-white/40">
        Select an event to inspect target, correlation id, detail, and related events.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 bg-white/[0.04] px-4 py-3">
        <div className="text-sm font-semibold tracking-[0.08em]">EVENT DETAIL</div>
        <div className="mt-1 truncate text-xs text-white/35">{event.id}</div>
      </div>
      <div className="max-h-[44vh] overflow-auto p-4 text-xs">
        <dl className="grid grid-cols-[112px_minmax(0,1fr)] gap-x-4 gap-y-2">
          <DetailRow label="Kind" value={kindLabel(event.kind)} />
          <DetailRow label="API" value={event.api} />
          <DetailRow label="Target" value={event.target} mono />
          <DetailRow label="Summary" value={event.summary} />
          <DetailRow label="Time" value={formatDateTime(event.at)} />
          <DetailRow label="Correlation" value={event.correlationId ?? "-"} mono />
          <DetailRow label="Status" value={String(event.status ?? "-")} />
          <DetailRow label="Duration" value={formatDuration(event.durationMs)} />
        </dl>

        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Detail</div>
          <pre className="max-h-48 overflow-auto rounded-md border border-white/10 bg-black/20 p-3 text-[11px] leading-relaxed text-white/65">
            {formatJson(event.detail ?? {})}
          </pre>
        </div>

        {relatedEvents.length > 1 ? (
          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Related Events</div>
            <div className="space-y-1.5">
              {relatedEvents.map((related) => (
                <div key={related.id} className="rounded border border-white/10 bg-white/[0.03] px-3 py-2">
                  <span className="text-white/35">{formatTime(related.at)}</span>
                  <span className="mx-2 text-white/20">/</span>
                  <span className="text-white/70">{kindLabel(related.kind)}</span>
                  <span className="mx-2 text-white/20">/</span>
                  <span className="text-white/55">{related.summary}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
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
  return JSON.stringify(value, null, 2);
}

function kindLabel(kind: ApiDebugEvent["kind"]): string {
  switch (kind) {
    case "backend_request":
      return "API受信";
    case "upstream_request":
      return "外部API";
    case "cache_hit":
      return "Cache hit";
    case "cache_miss":
      return "Cache miss";
    case "calculation":
      return "計算";
    case "error":
      return "Error";
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

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}
