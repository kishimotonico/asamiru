// ─── デバッグ計測 ───────────────────────────────────────────────────

export const API_DEBUG_LABELS: Record<string, string> = {
  "rail/line-status": "運行情報",
  "rail/departures": "発車情報",
  system: "システム",
};

export type ApiDebugKind =
  | "backend_request"
  | "upstream_request"
  | "cache_hit"
  | "cache_miss"
  | "calculation"
  | "error";

export type ApiDebugTotals = {
  backendRequests: number;
  upstreamRequests: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
};

export type ApiDebugApiStats = ApiDebugTotals & {
  api: string;
  label: string;
  lastEventAt?: string;
};

export type ApiDebugMetrics = {
  totals: ApiDebugTotals;
  apiStats: ApiDebugApiStats[];
  events: ApiDebugEvent[];
  lastUpdatedAt: string;
};

export type ApiDebugEvent = {
  id: string;
  at: string;
  kind: ApiDebugKind;
  api: string;
  target: string;
  summary: string;
  detail?: Record<string, unknown>;
  correlationId?: string;
  durationMs?: number;
  status?: number;
};
