import type { RailDeparturesResponse } from "@asamiru/shared";
import { recordDebugEvent, withUpstream } from "./metrics.js";
import { buildScheduleCandidates, selectDiakind } from "./timetable.js";
import { errorMessage } from "./errors.js";
import {
  destinationLabel,
  HACHIOJI_TAKAO_DESTINATIONS,
  HACHIOJI_TAKAO_LINE_STATIONS,
  SAGAMIHARA_LINE_DESTINATIONS,
  SAGAMIHARA_LINE_STATIONS,
  serviceLabel,
  STATION_ORDER_BY_NAME,
} from "./keioReference.js";

export { destinationLabel, serviceLabel } from "./keioReference.js";

type TrafficResponse = {
  TS?: TrafficPosition[];
  TB?: TrafficPosition[];
};

type TrafficPosition = {
  id?: string;
  sn?: string;
  ps?: TrainPosition[];
};

type TrainPosition = {
  tr?: string;
  sy?: string;
  sy_tr?: string;
  ki?: string;
  dl?: string;
  ik?: string;
  ik_tr?: string;
};

type DiaResponse = {
  dy?: DiaStop[];
};

type DiaStop = {
  sn?: string;
  ht?: string;
};

type TrainCandidate = {
  trainId: string;
  direction: string;
  kind: string;
  dest: string;
  scheduledMinutes: number;
  estimatedMinutes: number;
  delay: number;
  /** データソース。補完候補は "schedule" */
  source: "realtime" | "schedule";
};

type PositionedTrain = {
  train: TrainPosition;
  trainId: string;
  positionOrder: number;
  distanceToStation: number;
};

type StopCacheValue =
  | {
      stops: true;
      scheduledMinutes: number;
      destination: string;
    }
  | { stops: false };

const TRAFFIC_URL = "https://i.opentidkeio.jp/data/traffic_info.json";
const DIA_URL_BASE = "https://i.opentidkeio.jp/dia/";
const DEPARTURES_API = "rail/departures";
const TARGET_LINES = new Set(["K", "S"]);
const SERVICE_DAY_ROLLOVER_MINUTES = 4 * 60;
// Keep candidate exploration independent from small display counts so skipped trains do not starve results.
const MAX_DIA_CHECKS_PER_DIRECTION = 10;
const DIA_TTL_MS = 12 * 60 * 60 * 1000;
const TRAFFIC_TTL_MS = 120 * 1000;
const stopCache = new Map<string, StopCacheValue>();
const diaCache = new Map<string, { value: DiaResponse; expiresAt: number }>();
const diaInflight = new Map<string, Promise<DiaResponse>>();
let stopCacheServiceDate: string | undefined;
let diaCacheServiceDate: string | undefined;
let trafficCache: { value: TrafficResponse; expiresAt: number } | undefined;
let trafficInflight: Promise<TrafficResponse> | undefined;

// 未知の種別/行先コードは運行日内で同一コードにつき1回だけ debug イベントを記録する。
const reportedUnknownCodes = new Set<string>();
let reportedUnknownCodesServiceDate: string | undefined;

export function __resetCachesForTest(): void {
  stopCache.clear();
  diaCache.clear();
  diaInflight.clear();
  stopCacheServiceDate = undefined;
  diaCacheServiceDate = undefined;
  trafficCache = undefined;
  trafficInflight = undefined;
  reportedUnknownCodes.clear();
  reportedUnknownCodesServiceDate = undefined;
}

export type FetchDeparturesOptions = {
  boardingStation: string;
  displayCount: number;
  now?: Date;
  signal?: AbortSignal;
};

export async function fetchDepartures({
  boardingStation,
  displayCount,
  now = new Date(),
  signal,
}: FetchDeparturesOptions): Promise<RailDeparturesResponse> {
  const displayLimit = normalizedDisplayCount(displayCount);
  const maxDiaChecks = MAX_DIA_CHECKS_PER_DIRECTION;
  const serviceDate = serviceDateKey(now);
  pruneStopCache(serviceDate);
  pruneDiaCache(serviceDate);
  pruneUnknownCodeTracking(serviceDate);

  const boardingOrder = stationOrder(boardingStation);
  const traffic = await fetchTraffic(signal);
  const positionedTrains = collectUpcomingTrains(traffic, boardingStation, boardingOrder);
  const currentMinutes = currentServiceDayMinutes(now);
  const candidates: TrainCandidate[] = [];
  const validCounts = new Map<string, number>();
  const diaCheckCounts = new Map<string, number>();
  const failures: string[] = [];
  let resolvedStopChecks = 0;

  for (const { train, trainId } of positionedTrains) {
    signal?.throwIfAborted();

    const direction = directionKey(train.ki, "");
    if ((validCounts.get(direction) ?? 0) >= displayLimit) {
      continue;
    }

    let stop: StopCacheValue | undefined;
    try {
      stop = await resolveStopInfo({
        trainId,
        boardingStation,
        direction,
        serviceDate,
        signal,
        diaCheckCounts,
        maxDiaChecks,
      });
      if (stop) {
        resolvedStopChecks += 1;
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      failures.push(`${trainId}: ${errorMessage(error)}`);
      continue;
    }
    if (!stop?.stops) {
      continue;
    }

    const delay = parseDelay(train.dl);
    const estimatedMinutes = stop.scheduledMinutes + delay;
    if (estimatedMinutes < currentMinutes) {
      continue;
    }

    const serviceCode = train.sy_tr || train.sy;
    const kind = serviceLabel(serviceCode);
    reportUnknownCodeIfNeeded("service", serviceCode, kind, trainId);

    const destCode = train.ik_tr || train.ik;
    reportUnknownCodeIfNeeded("destination", destCode, destinationLabel(destCode), trainId);
    const dest = stop.destination || destinationLabel(destCode);

    candidates.push({
      trainId,
      direction,
      kind,
      dest,
      scheduledMinutes: stop.scheduledMinutes,
      estimatedMinutes,
      delay,
      source: "realtime",
    });
    validCounts.set(direction, (validCounts.get(direction) ?? 0) + 1);
  }

  if (candidates.length === 0 && failures.length > 0 && resolvedStopChecks === 0) {
    throw new Error(`All departure candidates failed: ${failures.join("; ")}`);
  }
  if (failures.length > 0) {
    console.error("fetchDepartures skipped candidates:", failures);
  }

  const diakind = selectDiakind(serviceDate);
  const realtimeTrainIds = new Set(candidates.map((c) => c.trainId.trim()));
  const directionCounts = new Map<string, number>();
  for (const c of candidates) {
    directionCounts.set(c.direction, (directionCounts.get(c.direction) ?? 0) + 1);
  }
  for (const direction of ["上り方面", "下り方面"]) {
    const count = directionCounts.get(direction) ?? 0;
    if (count < displayLimit) {
      const scheduleCandidates = buildScheduleCandidates(
        boardingStation,
        direction,
        diakind,
        currentMinutes,
        realtimeTrainIds,
      );
      candidates.push(...scheduleCandidates);
    }
  }

  const departures = groupDepartures(candidates, displayLimit);
  const departureCount = Object.values(departures).reduce((total, group) => total + group.length, 0);
  recordDebugEvent({
    kind: "calculation",
    api: DEPARTURES_API,
    target: boardingStation,
    summary: "Calculated departures",
    detail: {
      boardingStation,
      departureCount,
      displayLimit,
    },
  });
  return {
    station: boardingStation,
    departures,
  };
}

async function resolveStopInfo({
  trainId,
  boardingStation,
  direction,
  serviceDate,
  signal,
  diaCheckCounts,
  maxDiaChecks,
}: {
  trainId: string;
  boardingStation: string;
  direction: string;
  serviceDate: string;
  signal?: AbortSignal;
  diaCheckCounts: Map<string, number>;
  maxDiaChecks: number;
}): Promise<StopCacheValue | undefined> {
  const cacheKey = stopCacheKey(serviceDate, trainId, boardingStation);
  const cached = stopCache.get(cacheKey);
  if (cached) {
    recordDebugEvent({
      kind: "cache_hit",
      api: DEPARTURES_API,
      target: cacheKey,
      summary: "Stop cache hit",
      detail: { cache: "stop", trainId, boardingStation, result: cached.stops ? "stops" : "passes" },
    });
    return cached;
  }
  recordDebugEvent({
    kind: "cache_miss",
    api: DEPARTURES_API,
    target: cacheKey,
    summary: "Stop cache miss",
    detail: { cache: "stop", trainId, boardingStation },
  });

  const checks = diaCheckCounts.get(direction) ?? 0;
  if (checks >= maxDiaChecks) {
    return undefined;
  }
  diaCheckCounts.set(direction, checks + 1);

  const dia = await fetchDia(trainId, serviceDate, signal);
  const stopInfo = stopInfoFromDia(dia, boardingStation);
  stopCache.set(cacheKey, stopInfo);
  return stopInfo;
}

export function collectUpcomingTrains(
  traffic: TrafficResponse,
  boardingStation: string,
  boardingOrder: number,
): PositionedTrain[] {
  const byDirection = new Map<string, PositionedTrain[]>();

  for (const position of [...(traffic.TS ?? []), ...(traffic.TB ?? [])]) {
    if (!position.sn || !TARGET_LINES.has(position.sn)) {
      continue;
    }

    const positionOrder = parsePositionOrder(position.id);
    if (positionOrder === undefined) {
      continue;
    }

    for (const train of position.ps ?? []) {
      const trainId = train.tr?.trim();
      if (!trainId) {
        continue;
      }
      if (isProbablyUnreachableBranch(boardingStation, train)) {
        continue;
      }

      const distanceToStation = distanceBeforeBoarding(positionOrder, boardingOrder, train.ki);
      if (distanceToStation === undefined) {
        continue;
      }

      const direction = train.ki ?? "unknown";
      const group = byDirection.get(direction) ?? [];
      group.push({ train, trainId, positionOrder, distanceToStation });
      byDirection.set(direction, group);
    }
  }

  return [...byDirection.values()].flatMap((group) =>
    group.sort((a, b) => a.distanceToStation - b.distanceToStation || a.trainId.localeCompare(b.trainId)),
  );
}

async function fetchTraffic(signal?: AbortSignal): Promise<TrafficResponse> {
  if (trafficCache && trafficCache.expiresAt > Date.now()) {
    recordDebugEvent({
      kind: "cache_hit",
      api: DEPARTURES_API,
      target: TRAFFIC_URL,
      summary: "Traffic cache hit",
      detail: { cache: "traffic" },
    });
    return trafficCache.value;
  }
  if (trafficInflight) {
    recordDebugEvent({
      kind: "cache_hit",
      api: DEPARTURES_API,
      target: TRAFFIC_URL,
      summary: "Traffic request joined in-flight fetch",
      detail: { cache: "traffic", state: "inflight" },
    });
    return trafficInflight;
  }

  recordDebugEvent({
    kind: "cache_miss",
    api: DEPARTURES_API,
    target: TRAFFIC_URL,
    summary: "Traffic cache miss",
    detail: { cache: "traffic" },
  });
  trafficInflight = withUpstream(
    DEPARTURES_API,
    TRAFFIC_URL,
    () => fetch(TRAFFIC_URL, { signal }),
    { provider: "opentidkeio", resource: "traffic" },
  )
    .then(async (response) => {
      if (!response.ok) {
        recordDebugEvent({
          kind: "error",
          api: DEPARTURES_API,
          target: TRAFFIC_URL,
          summary: "opentidkeio traffic returned an error status",
          status: response.status,
          detail: { provider: "opentidkeio", resource: "traffic" },
        });
        throw new Error(`opentidkeio traffic returned ${response.status}`);
      }

      const value = (await response.json()) as TrafficResponse;
      const normalized = {
        TS: Array.isArray(value.TS) ? value.TS : [],
        TB: Array.isArray(value.TB) ? value.TB : [],
      };
      trafficCache = { value: normalized, expiresAt: Date.now() + TRAFFIC_TTL_MS };
      return normalized;
    })
    .finally(() => {
      trafficInflight = undefined;
    });
  return trafficInflight;
}

async function fetchDia(trainId: string, serviceDate: string, signal?: AbortSignal): Promise<DiaResponse> {
  const cacheKey = `${serviceDate}:${trainId}`;
  const cached = diaCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    recordDebugEvent({
      kind: "cache_hit",
      api: DEPARTURES_API,
      target: cacheKey,
      summary: "Dia cache hit",
      detail: { cache: "dia", trainId, serviceDate },
    });
    return cached.value;
  }
  const inflight = diaInflight.get(cacheKey);
  if (inflight) {
    recordDebugEvent({
      kind: "cache_hit",
      api: DEPARTURES_API,
      target: cacheKey,
      summary: "Dia request joined in-flight fetch",
      detail: { cache: "dia", trainId, serviceDate, state: "inflight" },
    });
    return inflight;
  }

  recordDebugEvent({
    kind: "cache_miss",
    api: DEPARTURES_API,
    target: cacheKey,
    summary: "Dia cache miss",
    detail: { cache: "dia", trainId, serviceDate },
  });
  const diaUrl = `${DIA_URL_BASE}${encodeURIComponent(trainId)}.json`;
  const request = withUpstream(
    DEPARTURES_API,
    diaUrl,
    () => fetch(diaUrl, { signal }),
    { provider: "opentidkeio", resource: "dia", trainId, serviceDate },
  )
    .then(async (response) => {
      if (!response.ok) {
        recordDebugEvent({
          kind: "error",
          api: DEPARTURES_API,
          target: diaUrl,
          summary: "opentidkeio dia returned an error status",
          status: response.status,
          detail: { provider: "opentidkeio", resource: "dia", trainId, serviceDate },
        });
        throw new Error(`opentidkeio dia ${trainId} returned ${response.status}`);
      }

      const value = (await response.json()) as DiaResponse;
      if (!Array.isArray(value.dy)) {
        recordDebugEvent({
          kind: "error",
          api: DEPARTURES_API,
          target: diaUrl,
          summary: "opentidkeio dia response is incomplete",
          detail: { provider: "opentidkeio", resource: "dia", trainId, serviceDate },
        });
        throw new Error(`opentidkeio dia ${trainId} response is incomplete`);
      }
      diaCache.set(cacheKey, { value, expiresAt: Date.now() + DIA_TTL_MS });
      return value;
    })
    .finally(() => {
      diaInflight.delete(cacheKey);
    });
  diaInflight.set(cacheKey, request);
  return request;
}

export function groupDepartures(candidates: TrainCandidate[], displayLimit: number): RailDeparturesResponse["departures"] {
  const grouped = new Map<string, TrainCandidate[]>();

  for (const candidate of candidates) {
    const group = grouped.get(candidate.direction) ?? [];
    group.push(candidate);
    grouped.set(candidate.direction, group);
  }

  return Object.fromEntries(
    [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "ja"))
      .map(([direction, trains]) => [
        direction,
        trains
          .sort((a, b) => a.estimatedMinutes - b.estimatedMinutes || a.trainId.localeCompare(b.trainId))
          .slice(0, displayLimit)
          .map((train) => ({
            time: formatMinutes(train.estimatedMinutes),
            scheduled: train.delay > 0 ? formatMinutes(train.scheduledMinutes) : undefined,
            kind: train.kind,
            dest: train.dest,
            delay: train.source === "realtime" ? train.delay : undefined,
            source: train.source,
          })),
      ]),
  );
}

function parseTimeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    throw new Error(`Invalid train time: ${time}`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function parseServiceDayTimeToMinutes(time: string): number {
  const minutes = parseTimeToMinutes(time);
  return minutes < SERVICE_DAY_ROLLOVER_MINUTES ? minutes + 24 * 60 : minutes;
}

export function parseDelay(delay: string | undefined): number {
  if (!delay) {
    return 0;
  }
  const parsed = Number(delay);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
}

export function parsePositionOrder(id: string | undefined): number | undefined {
  const match = /^[A-Z](\d{3})$/.exec(id ?? "");
  if (!match) {
    return undefined;
  }
  return Number(match[1]);
}

export function distanceBeforeBoarding(positionOrder: number, boardingOrder: number, direction: string | undefined): number | undefined {
  if (direction === "1") {
    return positionOrder <= boardingOrder ? boardingOrder - positionOrder : undefined;
  }
  if (direction === "0") {
    return positionOrder >= boardingOrder ? positionOrder - boardingOrder : undefined;
  }
  return undefined;
}

function stationOrder(stationName: string): number {
  const order = STATION_ORDER_BY_NAME.get(stationName);
  if (order === undefined) {
    throw new Error(`Unsupported KEIO boarding station: ${stationName}`);
  }
  return order;
}

function normalizedDisplayCount(displayCount: number): number {
  return Number.isFinite(displayCount) ? Math.max(1, Math.floor(displayCount)) : 1;
}

function stopInfoFromDia(dia: DiaResponse, boardingStation: string): StopCacheValue {
  const stop = dia.dy?.find((item) => item.sn === boardingStation);
  if (!stop?.ht) {
    return { stops: false };
  }

  return {
    stops: true,
    scheduledMinutes: parseServiceDayTimeToMinutes(stop.ht),
    destination: destinationFromDia(dia) ?? "",
  };
}

function stopCacheKey(serviceDate: string, trainId: string, boardingStation: string): string {
  return `${serviceDate}:${trainId}:${boardingStation}`;
}

function pruneStopCache(serviceDate: string): void {
  if (stopCacheServiceDate === serviceDate) {
    return;
  }

  stopCache.clear();
  stopCacheServiceDate = serviceDate;
}

function pruneDiaCache(serviceDate: string): void {
  if (diaCacheServiceDate === serviceDate) {
    return;
  }

  for (const key of diaCache.keys()) {
    if (!key.startsWith(`${serviceDate}:`)) {
      diaCache.delete(key);
    }
  }
  for (const key of diaInflight.keys()) {
    if (!key.startsWith(`${serviceDate}:`)) {
      diaInflight.delete(key);
    }
  }
  diaCacheServiceDate = serviceDate;
}

function pruneUnknownCodeTracking(serviceDate: string): void {
  if (reportedUnknownCodesServiceDate === serviceDate) {
    return;
  }

  reportedUnknownCodes.clear();
  reportedUnknownCodesServiceDate = serviceDate;
}

/**
 * serviceLabel / destinationLabel が未知コードのフォールバック表示（種別X / 行先X）を
 * 返した場合に debug イベントを記録する。運行日内で同一コードは1回だけ記録する。
 */
function reportUnknownCodeIfNeeded(
  type: "service" | "destination",
  code: string | undefined,
  label: string,
  trainId: string,
): void {
  if (!code) {
    return;
  }

  const fallback = type === "service" ? `種別${code}` : `行先${code}`;
  if (label !== fallback) {
    return;
  }

  const dedupeKey = `${type}:${code}`;
  if (reportedUnknownCodes.has(dedupeKey)) {
    return;
  }
  reportedUnknownCodes.add(dedupeKey);

  recordDebugEvent({
    kind: "error",
    api: DEPARTURES_API,
    target: dedupeKey,
    summary: `Unknown ${type} code: ${code}`,
    detail: { type, code, label, trainId },
  });
}

export function serviceDateKey(now: Date): string {
  const serviceDate = new Date(now);
  if (now.getHours() < SERVICE_DAY_ROLLOVER_MINUTES / 60) {
    serviceDate.setDate(serviceDate.getDate() - 1);
  }

  const year = serviceDate.getFullYear();
  const month = String(serviceDate.getMonth() + 1).padStart(2, "0");
  const day = String(serviceDate.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentServiceDayMinutes(now: Date): number {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes < SERVICE_DAY_ROLLOVER_MINUTES ? minutes + 24 * 60 : minutes;
}

export function isProbablyUnreachableBranch(boardingStation: string, train: TrainPosition): boolean {
  const branch = stationBranch(boardingStation);
  if (branch === "common") {
    return false;
  }

  const codes = destinationCodes(train);
  const hasSagamiharaDestination = codes.some((code) => SAGAMIHARA_LINE_DESTINATIONS.has(code));
  const hasHachiojiTakaoDestination = codes.some((code) => HACHIOJI_TAKAO_DESTINATIONS.has(code));

  if (branch === "sagamihara") {
    return hasHachiojiTakaoDestination && !hasSagamiharaDestination;
  }
  return hasSagamiharaDestination && !hasHachiojiTakaoDestination;
}

export function stationBranch(stationName: string): "common" | "sagamihara" | "hachiojiTakao" {
  if (SAGAMIHARA_LINE_STATIONS.has(stationName)) {
    return "sagamihara";
  }
  if (HACHIOJI_TAKAO_LINE_STATIONS.has(stationName)) {
    return "hachiojiTakao";
  }
  return "common";
}

function destinationCodes(train: TrainPosition): string[] {
  return [train.ik_tr, train.ik].filter((code): code is string => typeof code === "string" && code.length > 0);
}

export function formatMinutes(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const rest = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function destinationFromDia(dia: DiaResponse): string | undefined {
  const stops = dia.dy?.filter((stop) => stop.sn);
  return stops?.[stops.length - 1]?.sn;
}

export function directionKey(direction: string | undefined, dest: string): string {
  if (direction === "0") {
    return "上り方面";
  }
  if (direction === "1") {
    return "下り方面";
  }
  return dest ? `${dest}方面` : "方面未設定";
}
