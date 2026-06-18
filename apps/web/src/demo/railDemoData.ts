import type {
  WatchedLine,
  LineStatusResponse,
  RailDeparturesResponse,
  TrainStatusLevel,
} from "@asamiru/shared";
import type { TrainsSettings } from "../settings/catalog/types";

// ─── 架空駅・路線マスタ ────────────────────────────────────────────────────

export const DEMO_STATIONS: string[] = [
  "きさらぎ駅",
  "子ウサギ公園",
  "シタデル",
  "鐘崎港",
  "キツネ市場",
  "芸術学園前",
];

type DemoLineMeta = {
  name: string;
  /** カタログ識別子。MSW handler の route 解決には使われない */
  yahooUrl: string;
  status: string;
  level: TrainStatusLevel;
  note?: string;
};

/** 架空路線の完全情報。WatchedLine と LineStatus 両方の真実源 */
const DEMO_LINE_CATALOG: DemoLineMeta[] = [
  {
    name: "きさらぎ高速鉄道",
    yahooUrl: "demo:kisaragi-rapid",
    status: "遅延",
    level: "warn",
    note: "折り返し運転を実施しています",
  },
  {
    name: "きさらぎ市営地下鉄",
    yahooUrl: "demo:kisaragi-subway",
    status: "平常運転",
    level: "ok",
  },
  {
    name: "子ウサギ連絡鉄道",
    yahooUrl: "demo:trinity-rail",
    status: "平常運転",
    level: "ok",
  },
  {
    name: "月ノ宮急行電鉄",
    yahooUrl: "demo:gehenna-express",
    status: "平常運転",
    level: "ok",
  },
];

/** カタログの選択肢用（status を除いた WatchedLine 形式） */
export const DEMO_LINES: WatchedLine[] = DEMO_LINE_CATALOG.map(({ name, yahooUrl }) => ({
  name,
  yahooUrl,
}));

/** デモの既定設定 */
export const DEMO_DEFAULTS: TrainsSettings = {
  boardingStation: "きさらぎ駅",
  displayCount: 3,
  watchedLines: DEMO_LINES,
};

// ─── 次発情報生成 ──────────────────────────────────────────────────────────

function minutesLater(offset: number): string {
  const d = new Date(Date.now() + offset * 60_000);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * 現在時刻を起点に次発情報を組み立てる。
 * リクエストごとに呼ぶことで、何時に開いても「直近発車」に見える。
 */
export function buildDemoDepartures(): RailDeparturesResponse["departures"] {
  return {
    "子ウサギ公園・シタデル方面": [
      // きさらぎライナーバッジの特別スタイルを確認できるよう先頭に置く
      { time: minutesLater(1), kind: "きさらぎライナー", dest: "芸術学園前", delay: 0, source: "realtime" },
      { time: minutesLater(6), kind: "準特急", dest: "シタデル", source: "realtime" },
      { time: minutesLater(14), kind: "各停", dest: "子ウサギ公園", source: "schedule" },
    ],
    "鐘崎港・キツネ市場方面": [
      { time: minutesLater(5), scheduled: minutesLater(1), kind: "急行", dest: "鐘崎港", delay: 4, source: "realtime" },
      { time: minutesLater(8), kind: "各停", dest: "キツネ市場", source: "realtime" },
      { time: minutesLater(17), kind: "準特急", dest: "鐘崎港", source: "schedule" },
    ],
  };
}

// ─── 運行情報生成 ──────────────────────────────────────────────────────────

/**
 * 監視路線リストに対して架空の運行情報を返す。
 * DEMO_LINE_CATALOG の yahooUrl で照合し、未知路線は「平常運転/ok」を既定とする。
 * 設定で選んだ路線がそのまま運行情報パネルに反映される。
 *
 * @param lines リクエストボディの `lines`（API クライアントは `{ lines }` で POST する）
 */
export function buildDemoLineStatus(lines: WatchedLine[]): LineStatusResponse {
  const now = new Date().toISOString();
  return {
    source: "yahoo-transit",
    fetchedAt: now,
    lines: lines.map((watched) => {
      const meta = DEMO_LINE_CATALOG.find((m) => m.yahooUrl === watched.yahooUrl);
      return {
        name: watched.name,
        status: meta?.status ?? "平常運転",
        level: meta?.level ?? "ok",
        note: meta?.note,
        sourceUrl: watched.yahooUrl,
        checkedAt: now,
      };
    }),
  };
}
