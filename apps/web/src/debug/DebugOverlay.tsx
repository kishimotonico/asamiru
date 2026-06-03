import { useEffect, useState } from "react";
import { isTextInputTarget } from "../lib/dom";
import { formatTime } from "./format";
import { useDebugMetrics } from "./useDebugMetrics";
import { SummaryTile } from "./SummaryTile";
import { ApiStatsTable } from "./ApiStatsTable";
import { EventHistory } from "./EventHistory";

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
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  const { metrics, metricsError, metricsLoading, refreshMetrics } = useDebugMetrics(visible, setExpandedEventId);

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
            <ApiStatsTable metrics={metrics} />
            <EventHistory
              metrics={metrics}
              expandedEventId={expandedEventId}
              onToggleEvent={(id) => setExpandedEventId((current) => (current === id ? null : id))}
            />
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
