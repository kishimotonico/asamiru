import type { DashboardData } from "../dashboard/types";

type TrafficResponse = {
  TS?: TrafficPosition[];
  TB?: TrafficPosition[];
};

type TrafficPosition = {
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
};

const TRAFFIC_URL = "https://i.opentidkeio.jp/data/traffic_info.json";
const DIA_URL_BASE = "https://i.opentidkeio.jp/dia/";
const TRAFFIC_TTL_MS = 60 * 1000;
const DIA_TTL_MS = 6 * 60 * 60 * 1000;
const DISPLAY_LIMIT_PER_DIRECTION = 3;
const TARGET_LINES = new Set(["K", "S"]);

const diaCache = new Map<string, { value: DiaResponse; expiresAt: number }>();
const diaInflight = new Map<string, Promise<DiaResponse>>();
let trafficInflight: Promise<TrafficResponse> | undefined;
let trafficCache: { value: TrafficResponse; expiresAt: number } | undefined;

export async function fetchTrains(now = new Date()): Promise<DashboardData["trains"]> {
  const boardingStation = import.meta.env.VITE_KEIO_BOARDING_STATION?.trim();
  const directionFilter = readDirectionFilter();
  if (!boardingStation) {
    throw new Error("VITE_KEIO_BOARDING_STATION is required");
  }

  const traffic = await fetchTraffic();
  const positions = [...(traffic.TS ?? []), ...(traffic.TB ?? [])];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const candidates: TrainCandidate[] = [];

  for (const position of positions) {
    if (!position.sn || !TARGET_LINES.has(position.sn)) {
      continue;
    }

    for (const train of position.ps ?? []) {
      const trainId = train.tr?.trim();
      if (!trainId) {
        continue;
      }

      if (directionFilter !== "both" && train.ki !== directionFilter) {
        continue;
      }

      const dia = await fetchDia(trainId);
      const stop = dia.dy?.find((item) => item.sn === boardingStation);
      if (!stop?.ht) {
        continue;
      }

      const scheduledMinutes = parseTimeToMinutes(stop.ht);
      const delay = parseDelay(train.dl);
      const estimatedMinutes = scheduledMinutes + delay;
      if (estimatedMinutes < currentMinutes) {
        continue;
      }

      const dest = destinationFromDia(dia) ?? destinationLabel(train.ik_tr || train.ik);
      candidates.push({
        trainId,
        direction: directionKey(train.ki, dest),
        kind: serviceLabel(train.sy_tr || train.sy),
        dest,
        scheduledMinutes,
        estimatedMinutes,
        delay,
      });
    }
  }

  return {
    station: boardingStation,
    departures: groupDepartures(candidates),
    lines: [],
  };
}

async function fetchTraffic(): Promise<TrafficResponse> {
  const cached = trafficCache;
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (!trafficInflight) {
    trafficInflight = fetch(TRAFFIC_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`opentidkeio traffic returned ${response.status}`);
        }

        const value = (await response.json()) as TrafficResponse;
        if (!Array.isArray(value.TS) || !Array.isArray(value.TB)) {
          throw new Error("opentidkeio traffic response is incomplete");
        }

        trafficCache = { value, expiresAt: Date.now() + TRAFFIC_TTL_MS };
        return value;
      })
      .finally(() => {
        trafficInflight = undefined;
      });
  }

  return trafficInflight;
}

async function fetchDia(trainId: string): Promise<DiaResponse> {
  const cached = diaCache.get(trainId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inflight = diaInflight.get(trainId);
  if (inflight) {
    return inflight;
  }

  const request = fetch(`${DIA_URL_BASE}${encodeURIComponent(trainId)}.json`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`opentidkeio dia ${trainId} returned ${response.status}`);
      }

      const value = (await response.json()) as DiaResponse;
      if (!Array.isArray(value.dy)) {
        throw new Error(`opentidkeio dia ${trainId} response is incomplete`);
      }

      diaCache.set(trainId, { value, expiresAt: Date.now() + DIA_TTL_MS });
      return value;
    })
    .finally(() => {
      diaInflight.delete(trainId);
    });

  diaInflight.set(trainId, request);
  return request;
}

function groupDepartures(candidates: TrainCandidate[]): DashboardData["trains"]["departures"] {
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
          .slice(0, DISPLAY_LIMIT_PER_DIRECTION)
          .map((train) => ({
            time: formatMinutes(train.estimatedMinutes),
            scheduled: train.delay > 0 ? formatMinutes(train.scheduledMinutes) : undefined,
            kind: train.kind,
            dest: train.dest,
            delay: train.delay,
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

function parseDelay(delay: string | undefined): number {
  if (!delay) {
    return 0;
  }
  const parsed = Number(delay);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, parsed);
}

function formatMinutes(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const rest = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function destinationFromDia(dia: DiaResponse): string | undefined {
  const stops = dia.dy?.filter((stop) => stop.sn);
  return stops?.[stops.length - 1]?.sn;
}

function directionKey(direction: string | undefined, dest: string): string {
  if (direction === "0") {
    return "上り方面";
  }
  if (direction === "1") {
    return "下り方面";
  }
  return dest ? `${dest}方面` : "方面未設定";
}

function readDirectionFilter(): "0" | "1" | "both" {
  const value = import.meta.env.VITE_KEIO_DIRECTIONS?.trim().toLowerCase();
  if (!value || value === "both") {
    return "both";
  }
  if (value === "up" || value === "0") {
    return "0";
  }
  if (value === "down" || value === "1") {
    return "1";
  }
  throw new Error(`Invalid VITE_KEIO_DIRECTIONS: ${value}`);
}

function serviceLabel(code: string | undefined): string {
  switch (code) {
    case "1":
      return "特急";
    case "2":
      return "急行";
    case "3":
      return "快速";
    case "4":
      return "準特急";
    case "5":
      return "区間急行";
    case "6":
      return "各駅停車";
    case "7":
      return "回送";
    case "9":
      return "京王ライナー";
    case "10":
      return "臨時";
    case "11":
      return "Mt.TAKAO号";
    default:
      return code ? `種別${code}` : "不明";
  }
}

function destinationLabel(code: string | undefined): string {
  switch (code) {
    case "001":
      return "新宿";
    case "032":
      return "京王八王子";
    case "036":
      return "高幡不動";
    case "037":
      return "北野";
    case "043":
      return "高尾山口";
    case "048":
      return "橋本";
    case "054":
      return "橋本";
    case "081":
      return "渋谷";
    case "097":
      return "吉祥寺";
    case "120":
      return "本八幡";
    case "301":
      return "新線新宿";
    default:
      return code ? `行先${code}` : "不明";
  }
}
