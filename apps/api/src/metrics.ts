import type { ApiDebugMetrics } from "@asamiru/shared";

const metrics: ApiDebugMetrics = {
  lineStatus: {
    requests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    upstreamRequests: 0,
  },
  departures: {
    requests: 0,
    trafficRequests: 0,
    trafficCacheHits: 0,
    trafficCacheMisses: 0,
    diaRequests: 0,
    diaCacheHits: 0,
    diaCacheMisses: 0,
    stopCacheHits: 0,
    stopCacheMisses: 0,
  },
  events: [],
  lastUpdatedAt: new Date(0).toISOString(),
};

const MAX_EVENTS = 50;

function touch(at = new Date().toISOString()) {
  metrics.lastUpdatedAt = at;
}

function pushEvent(area: ApiDebugMetrics["events"][number]["area"], event: string, detail?: string) {
  const at = new Date().toISOString();
  metrics.events.unshift({ at, area, event, detail });
  if (metrics.events.length > MAX_EVENTS) {
    metrics.events.length = MAX_EVENTS;
  }
  touch(at);
}

export function recordLineStatusRequest(lineCount: number) {
  metrics.lineStatus.requests += 1;
  pushEvent("api", "POST /api/rail/line-status", `${lineCount} lines`);
}

export function recordLineStatusCacheHit(lineName: string) {
  metrics.lineStatus.cacheHits += 1;
  pushEvent("lineStatus", "cache hit", lineName);
}

export function recordLineStatusCacheMiss(lineName: string) {
  metrics.lineStatus.cacheMisses += 1;
  pushEvent("lineStatus", "cache miss", lineName);
}

export function recordLineStatusUpstreamRequest(url: string) {
  metrics.lineStatus.upstreamRequests += 1;
  metrics.lineStatus.lastFetchAt = new Date().toISOString();
  pushEvent("lineStatus", "Yahoo request", url);
}

export function recordDeparturesRequest(boardingStation: string, displayCount: number) {
  metrics.departures.requests += 1;
  pushEvent("api", "POST /api/rail/departures", `${boardingStation}, ${displayCount} departures`);
}

export function recordDeparturesTrafficCacheHit() {
  metrics.departures.trafficCacheHits += 1;
  pushEvent("departures", "traffic cache hit");
}

export function recordDeparturesTrafficCacheMiss() {
  metrics.departures.trafficCacheMisses += 1;
  pushEvent("departures", "traffic cache miss");
}

export function recordDeparturesTrafficRequest() {
  metrics.departures.trafficRequests += 1;
  metrics.departures.lastTrafficFetchAt = new Date().toISOString();
  pushEvent("departures", "traffic request");
}

export function recordDeparturesDiaRequest(trainId: string) {
  metrics.departures.diaRequests += 1;
  pushEvent("departures", "dia request", trainId);
}

export function recordDeparturesDiaCacheHit(trainId: string) {
  metrics.departures.diaCacheHits += 1;
  pushEvent("departures", "dia cache hit", trainId);
}

export function recordDeparturesDiaCacheMiss(trainId: string) {
  metrics.departures.diaCacheMisses += 1;
  pushEvent("departures", "dia cache miss", trainId);
}

export function recordDeparturesStopCacheHit(trainId: string) {
  metrics.departures.stopCacheHits += 1;
  pushEvent("departures", "stop cache hit", trainId);
}

export function recordDeparturesStopCacheMiss(trainId: string) {
  metrics.departures.stopCacheMisses += 1;
  pushEvent("departures", "stop cache miss", trainId);
}

export function recordDeparturesCalculated(station: string, departureCount: number) {
  metrics.departures.lastCalculatedAt = new Date().toISOString();
  pushEvent("departures", "calculated", `${station}, ${departureCount} departures`);
}

export function getDebugMetrics(): ApiDebugMetrics {
  return structuredClone(metrics);
}
