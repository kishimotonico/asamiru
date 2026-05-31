import { useState, useEffect } from "react";
import type { ApiDebugMetrics } from "@asamiru/shared";

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
  const [visible, setVisible] = useState(true);
  const [info, setInfo] = useState<Info>(snapshot);
  const [metrics, setMetrics] = useState<ApiDebugMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`") setVisible((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!visible) return null;

  async function refreshMetrics() {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const response = await fetch(DEBUG_METRICS_ENDPOINT);
      if (!response.ok) {
        throw new Error(`debug metrics returned ${response.status}`);
      }
      setMetrics((await response.json()) as ApiDebugMetrics);
    } catch (error) {
      setMetricsError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setMetricsLoading(false);
    }
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] max-h-[88vh] w-[min(920px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-white/10 bg-[#111317]/95 text-white shadow-2xl backdrop-blur-sm"
      style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace" }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-base font-semibold tracking-[0.08em]">DEBUG PANEL</div>
          <div className="mt-1 text-xs text-white/40">
            {info.w} x {info.h} / {breakpoint(info.w)} / DPR {info.dpr.toFixed(1)} / scroll {info.scrollY}px
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshMetrics}
            disabled={metricsLoading}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#111317] hover:bg-white/90 disabled:opacity-40"
          >
            {metricsLoading ? "Loading..." : "Refresh API"}
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

        {metrics ? (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard
                title="Line Status"
                primary={`${metrics.lineStatus.upstreamRequests} upstream`}
                rows={[
                  ["API requests", metrics.lineStatus.requests],
                  ["Cache hit", metrics.lineStatus.cacheHits],
                  ["Cache miss", metrics.lineStatus.cacheMisses],
                  ["Last fetch", formatTime(metrics.lineStatus.lastFetchAt)],
                ]}
              />
              <MetricCard
                title="Departures Traffic"
                primary={`${metrics.departures.trafficRequests} traffic fetches`}
                rows={[
                  ["API requests", metrics.departures.requests],
                  ["Traffic hit", metrics.departures.trafficCacheHits],
                  ["Traffic miss", metrics.departures.trafficCacheMisses],
                  ["Last traffic", formatTime(metrics.departures.lastTrafficFetchAt)],
                ]}
              />
              <MetricCard
                title="Departures Detail"
                primary={`${metrics.departures.diaRequests} dia fetches`}
                rows={[
                  ["Dia hit/miss", `${metrics.departures.diaCacheHits} / ${metrics.departures.diaCacheMisses}`],
                  ["Stop hit/miss", `${metrics.departures.stopCacheHits} / ${metrics.departures.stopCacheMisses}`],
                  ["Last calc", formatTime(metrics.departures.lastCalculatedAt)],
                  ["Metrics at", formatTime(metrics.lastUpdatedAt)],
                ]}
              />
            </div>

            <div className="mt-5 overflow-hidden rounded-lg border border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-3">
                <div className="text-sm font-semibold tracking-[0.08em]">API HISTORY</div>
                <div className="text-xs text-white/35">{metrics.events.length} recent events</div>
              </div>
              <div className="max-h-[46vh] overflow-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-[#191c22] text-white/40">
                    <tr>
                      <th className="w-28 px-4 py-2 font-medium">Time</th>
                      <th className="w-28 px-4 py-2 font-medium">Area</th>
                      <th className="w-44 px-4 py-2 font-medium">Event</th>
                      <th className="px-4 py-2 font-medium">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.events.map((event, index) => (
                      <tr key={`${event.at}-${index}`} className="border-t border-white/[0.06] odd:bg-white/[0.02]">
                        <td className="whitespace-nowrap px-4 py-2 text-white/55">{formatTime(event.at)}</td>
                        <td className="px-4 py-2">
                          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${areaClassName(event.area)}`}>
                            {event.area}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-white/80">{event.event}</td>
                        <td className="max-w-[360px] truncate px-4 py-2 text-white/45">{event.detail ?? "-"}</td>
                      </tr>
                    ))}
                    {metrics.events.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-white/35">
                          No API history yet. Press Refresh API after the dashboard has loaded.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : metricsError ? (
          null
        ) : (
          <div className="rounded-lg border border-dashed border-white/15 px-5 py-10 text-center">
            <div className="text-base font-semibold">API metrics are not loaded</div>
            <div className="mt-2 text-sm text-white/45">Press Refresh API to load the current counters and request history.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, primary, rows }: { title: string; primary: string; rows: Array<[string, string | number]> }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{primary}</div>
      <div className="mt-4 space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 text-xs">
            <span className="text-white/35">{label}</span>
            <span className="text-right text-white/70">{value}</span>
          </div>
        ))}
      </div>
    </div>
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

function areaClassName(area: ApiDebugMetrics["events"][number]["area"]): string {
  switch (area) {
    case "api":
      return "bg-sky-400/15 text-sky-200";
    case "lineStatus":
      return "bg-emerald-400/15 text-emerald-200";
    case "departures":
      return "bg-amber-400/15 text-amber-200";
  }
}
