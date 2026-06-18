import type {
  ApiDebugApiStats,
  ApiDebugEvent,
  ApiDebugMetrics,
  ApiDebugTotals,
} from "@asamiru/shared";
import { API_DEBUG_LABELS } from "@asamiru/shared";

// ─── デモ用デバッグ計測 ────────────────────────────────────────────────────
//
// デモは API サーバーを持たないため /api/debug/metrics の実体が無い。
// パネルを実機同様に見せるための架空メトリクスをここで組み立てる。
// 現在時刻起点で生成し、いつ開いても「直近のアクティビティ」に見えるようにする。

function secondsAgo(offset: number): string {
  return new Date(Date.now() - offset * 1000).toISOString();
}

/** events から api ごとの集計を導出する（実 API の集計ロジックと整合させる） */
function aggregate(events: ApiDebugEvent[]): { totals: ApiDebugTotals; apiStats: ApiDebugApiStats[] } {
  const empty = (): ApiDebugTotals => ({
    backendRequests: 0,
    upstreamRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
  });
  const add = (acc: ApiDebugTotals, event: ApiDebugEvent) => {
    if (event.kind === "backend_request") acc.backendRequests += 1;
    if (event.kind === "upstream_request") acc.upstreamRequests += 1;
    if (event.kind === "cache_hit") acc.cacheHits += 1;
    if (event.kind === "cache_miss") acc.cacheMisses += 1;
    if (event.kind === "error") acc.errors += 1;
  };

  const totals = empty();
  const byApi = new Map<string, ApiDebugApiStats>();
  for (const event of events) {
    add(totals, event);
    const current =
      byApi.get(event.api) ??
      ({ api: event.api, label: API_DEBUG_LABELS[event.api] ?? event.api, ...empty() } satisfies ApiDebugApiStats);
    add(current, event);
    // events は新しい順に並べる前提なので、最初に見た at を lastEventAt とする
    current.lastEventAt = current.lastEventAt ?? event.at;
    byApi.set(event.api, current);
  }

  return { totals, apiStats: [...byApi.values()] };
}

/**
 * デモ用の架空デバッグメトリクスを組み立てる。
 * リクエストごとに呼ぶことで、events の時刻が常に直近になる。
 */
export function buildDemoDebugMetrics(): ApiDebugMetrics {
  const events: ApiDebugEvent[] = [
    {
      id: "demo-evt-1",
      at: secondsAgo(4),
      kind: "cache_hit",
      api: "rail/departures",
      target: "きさらぎ駅",
      summary: "発車情報をキャッシュから応答",
      correlationId: "demo-corr-a1",
      durationMs: 2,
    },
    {
      id: "demo-evt-2",
      at: secondsAgo(9),
      kind: "backend_request",
      api: "rail/departures",
      target: "POST /api/rail/departures",
      summary: "次発情報リクエストを受信",
      correlationId: "demo-corr-a1",
      durationMs: 41,
      status: 200,
    },
    {
      id: "demo-evt-3",
      at: secondsAgo(23),
      kind: "upstream_request",
      api: "rail/line-status",
      target: "yahoo-transit",
      summary: "運行情報を上流から取得",
      detail: { lines: 4, changed: 1 },
      correlationId: "demo-corr-b2",
      durationMs: 318,
      status: 200,
    },
    {
      id: "demo-evt-4",
      at: secondsAgo(24),
      kind: "cache_miss",
      api: "rail/line-status",
      target: "yahoo-transit",
      summary: "運行情報キャッシュ未ヒット",
      correlationId: "demo-corr-b2",
    },
    {
      id: "demo-evt-5",
      at: secondsAgo(58),
      kind: "calculation",
      api: "calendar/events",
      target: "ICS 集計",
      summary: "直近14日の予定を整形",
      detail: { sources: 2, events: 7 },
      durationMs: 6,
    },
    {
      id: "demo-evt-6",
      at: secondsAgo(61),
      kind: "upstream_request",
      api: "calendar/events",
      target: "ics fetch",
      summary: "カレンダーICSを取得",
      correlationId: "demo-corr-c3",
      durationMs: 142,
      status: 200,
    },
    {
      id: "demo-evt-7",
      at: secondsAgo(126),
      kind: "error",
      api: "rail/line-status",
      target: "yahoo-transit",
      summary: "上流が一時的に応答せずリトライ",
      detail: { attempt: 1, recovered: true },
      correlationId: "demo-corr-b2",
      durationMs: 5012,
      status: 503,
    },
  ];

  const { totals, apiStats } = aggregate(events);
  return {
    totals,
    apiStats,
    events,
    lastUpdatedAt: new Date().toISOString(),
  };
}
