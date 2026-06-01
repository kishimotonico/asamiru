import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { API_DEBUG_LABELS } from "@asamiru/shared";
import type { ApiDebugApiStats, ApiDebugEvent, ApiDebugKind, ApiDebugMetrics, ApiDebugTotals } from "@asamiru/shared";

type DebugContext = {
  correlationId: string;
};

type DebugEventInput = {
  kind: ApiDebugKind;
  api: string;
  target: string;
  summary: string;
  detail?: Record<string, unknown>;
  correlationId?: string;
  durationMs?: number;
  status?: number;
};

const MAX_EVENTS = 50;
const contextStorage = new AsyncLocalStorage<DebugContext>();

const totals: ApiDebugTotals = emptyTotals();
const statsByApi = new Map<string, ApiDebugApiStats>();
const events: ApiDebugEvent[] = [];
let lastUpdatedAt = new Date(0).toISOString();

export function runWithDebugContext<T>(correlationId: string, callback: () => T): T {
  return contextStorage.run({ correlationId }, callback);
}

export function createCorrelationId(): string {
  return randomUUID();
}

export function currentCorrelationId(): string | undefined {
  return contextStorage.getStore()?.correlationId;
}

export function recordDebugEvent(input: DebugEventInput): ApiDebugEvent {
  const at = new Date().toISOString();
  const event: ApiDebugEvent = {
    id: randomUUID(),
    at,
    kind: input.kind,
    api: input.api,
    target: input.target,
    summary: input.summary,
    detail: input.detail,
    correlationId: input.correlationId ?? currentCorrelationId(),
    durationMs: input.durationMs,
    status: input.status,
  };

  events.unshift(event);
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }
  updateCounters(event);
  lastUpdatedAt = at;
  return event;
}

export async function withUpstream(
  api: string,
  target: string,
  request: () => Promise<Response>,
  detail?: Record<string, unknown>,
): Promise<Response> {
  const startedAt = performance.now();
  try {
    const response = await request();
    recordDebugEvent({
      kind: "upstream_request",
      api,
      target,
      summary: `External API returned ${response.status}`,
      status: response.status,
      durationMs: elapsedMs(startedAt),
      detail,
    });
    return response;
  } catch (error) {
    recordDebugEvent({
      kind: "upstream_request",
      api,
      target,
      summary: "External API request failed",
      durationMs: elapsedMs(startedAt),
      detail,
    });
    recordDebugEvent({
      kind: "error",
      api,
      target,
      summary: "External API request failed",
      durationMs: elapsedMs(startedAt),
      detail: {
        ...detail,
        message: errorMessage(error),
      },
    });
    throw error;
  }
}

export function getDebugMetrics(): ApiDebugMetrics {
  return structuredClone({
    totals,
    apiStats: apiStats(),
    events,
    lastUpdatedAt,
  });
}

function updateCounters(event: ApiDebugEvent): void {
  const stat = statForApi(event.api);
  stat.lastEventAt = event.at;

  switch (event.kind) {
    case "backend_request":
      totals.backendRequests += 1;
      stat.backendRequests += 1;
      return;
    case "upstream_request":
      totals.upstreamRequests += 1;
      stat.upstreamRequests += 1;
      return;
    case "cache_hit":
      totals.cacheHits += 1;
      stat.cacheHits += 1;
      return;
    case "cache_miss":
      totals.cacheMisses += 1;
      stat.cacheMisses += 1;
      return;
    case "error":
      totals.errors += 1;
      stat.errors += 1;
      return;
    case "calculation":
      return;
  }
}

function statForApi(api: string): ApiDebugApiStats {
  const current = statsByApi.get(api);
  if (current) {
    return current;
  }

  const created: ApiDebugApiStats = {
    api,
    label: API_DEBUG_LABELS[api] ?? api,
    ...emptyTotals(),
  };
  statsByApi.set(api, created);
  return created;
}

function apiStats(): ApiDebugApiStats[] {
  for (const api of Object.keys(API_DEBUG_LABELS)) {
    statForApi(api);
  }

  return [...statsByApi.values()].sort((a, b) => a.label.localeCompare(b.label, "ja"));
}

function emptyTotals(): ApiDebugTotals {
  return {
    backendRequests: 0,
    upstreamRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
  };
}

function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
