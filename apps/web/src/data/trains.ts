import type { DashboardData } from "../dashboard/types";

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

export type DiaResponse = {
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

type PositionedTrain = {
  train: TrainPosition;
  trainId: string;
  positionOrder: number;
  distanceToStation: number;
};

const TRAFFIC_URL = "https://i.opentidkeio.jp/data/traffic_info.json";
const DIA_URL_BASE = "https://i.opentidkeio.jp/dia/";
const DISPLAY_LIMIT_PER_DIRECTION = 3;
const PREFETCH_LIMIT_PER_DIRECTION = 6;
const TARGET_LINES = new Set(["K", "S"]);
const STATION_ORDER_BY_NAME: ReadonlyMap<string, number> = new Map(
  [
    ["新宿", 1],
    ["笹塚", 2],
    ["代田橋", 3],
    ["明大前", 4],
    ["下高井戸", 5],
    ["桜上水", 6],
    ["上北沢", 7],
    ["八幡山", 8],
    ["芦花公園", 9],
    ["千歳烏山", 10],
    ["仙川", 11],
    ["つつじヶ丘", 12],
    ["柴崎", 13],
    ["国領", 14],
    ["布田", 15],
    ["調布", 16],
    ["西調布", 17],
    ["飛田給", 18],
    ["武蔵野台", 19],
    ["多磨霊園", 20],
    ["東府中", 21],
    ["府中", 22],
    ["分倍河原", 23],
    ["中河原", 24],
    ["聖蹟桜ヶ丘", 25],
    ["百草園", 26],
    ["高幡不動", 27],
    ["南平", 28],
    ["平山城址公園", 29],
    ["長沼", 30],
    ["北野", 31],
    ["京王八王子", 32],
    ["新線新宿", 33],
    ["初台", 34],
    ["幡ヶ谷", 35],
    ["京王片倉", 38],
    ["山田", 39],
    ["めじろ台", 40],
    ["狭間", 41],
    ["高尾", 42],
    ["高尾山口", 43],
    ["京王多摩川", 44],
    ["京王稲田堤", 45],
    ["京王よみうりランド", 46],
    ["稲城", 47],
    ["若葉台", 48],
    ["京王永山", 49],
    ["京王多摩センター", 50],
    ["京王堀之内", 51],
    ["南大沢", 52],
    ["多摩境", 53],
    ["橋本", 54],
  ] as const,
);

type FetchTrainsOptions = {
  loadDia: (trainId: string) => Promise<DiaResponse>;
  now?: Date;
  signal?: AbortSignal;
};

type FetchDiaOptions = {
  signal?: AbortSignal;
};

export async function fetchTrains({ loadDia, now = new Date(), signal }: FetchTrainsOptions): Promise<DashboardData["trains"]> {
  const boardingStation = import.meta.env.VITE_KEIO_BOARDING_STATION?.trim();
  const directionFilter = readDirectionFilter();
  if (!boardingStation) {
    throw new Error("VITE_KEIO_BOARDING_STATION is required");
  }

  const boardingOrder = stationOrder(boardingStation);
  const traffic = await fetchTraffic(signal);
  const positionedTrains = collectUpcomingTrains(traffic, boardingOrder, directionFilter);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const candidates: TrainCandidate[] = [];
  const validCounts = new Map<string, number>();
  const failures: string[] = [];

  for (const { train, trainId } of positionedTrains) {
    signal?.throwIfAborted();

    const direction = directionKey(train.ki, "");
    if ((validCounts.get(direction) ?? 0) >= DISPLAY_LIMIT_PER_DIRECTION) {
      continue;
    }

    try {
      const dia = await loadDia(trainId);
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
        direction,
        kind: serviceLabel(train.sy_tr || train.sy),
        dest,
        scheduledMinutes,
        estimatedMinutes,
        delay,
      });
      validCounts.set(direction, (validCounts.get(direction) ?? 0) + 1);
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      failures.push(`${trainId}: ${errorMessage(error)}`);
    }
  }

  if (candidates.length === 0 && failures.length > 0) {
    throw new Error(`列車時刻表の取得に失敗しました: ${failures.slice(0, 3).join(", ")}`);
  }

  return {
    station: boardingStation,
    departures: groupDepartures(candidates),
    lines: [],
  };
}

function collectUpcomingTrains(
  traffic: TrafficResponse,
  boardingOrder: number,
  directionFilter: "0" | "1" | "both",
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
      if (!trainId || (directionFilter !== "both" && train.ki !== directionFilter)) {
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
    group
      .sort((a, b) => a.distanceToStation - b.distanceToStation || a.trainId.localeCompare(b.trainId))
      .slice(0, PREFETCH_LIMIT_PER_DIRECTION),
  );
}

async function fetchTraffic(signal?: AbortSignal): Promise<TrafficResponse> {
  const response = await fetch(TRAFFIC_URL, { signal });
  if (!response.ok) {
    throw new Error(`opentidkeio traffic returned ${response.status}`);
  }

  const value = (await response.json()) as TrafficResponse;
  if (!Array.isArray(value.TS) || !Array.isArray(value.TB)) {
    throw new Error("opentidkeio traffic response is incomplete");
  }

  return value;
}

export async function fetchTrainDia(trainId: string, { signal }: FetchDiaOptions = {}): Promise<DiaResponse> {
  const response = await fetch(`${DIA_URL_BASE}${encodeURIComponent(trainId)}.json`, { signal });
  if (!response.ok) {
    throw new Error(`opentidkeio dia ${trainId} returned ${response.status}`);
  }

  const value = (await response.json()) as DiaResponse;
  if (!Array.isArray(value.dy)) {
    throw new Error(`opentidkeio dia ${trainId} response is incomplete`);
  }

  return value;
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

function parsePositionOrder(id: string | undefined): number | undefined {
  const match = /^[A-Z](\d{3})$/.exec(id ?? "");
  if (!match) {
    return undefined;
  }
  return Number(match[1]);
}

function distanceBeforeBoarding(positionOrder: number, boardingOrder: number, direction: string | undefined): number | undefined {
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
