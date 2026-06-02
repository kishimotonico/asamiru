/**
 * 京王線の駅別時刻表データを navitime API からスクレイピングし、
 * src/data/timetable.json に出力する。
 * 実行: pnpm --filter api scrape:timetable
 * 実行頻度: ダイヤ改正時のみ（年1回未満）
 */

import { load } from "cheerio";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "../src/data/timetable.json");

const KEIO_STATION_LIST_URL = "https://www.keio.co.jp/train/station/";
const NAVITIME_API_BASE = "https://transfer-train.navitime.biz/api/keio/timetable";
const USER_AGENT = "asamiru-timetable-scraper/1.0 (personal home dashboard)";
const REQUEST_INTERVAL_MS = 800;

// 井の頭線は本アプリ対象外
const EXCLUDED_LINES = new Set(["7"]);

type NavitimeMinute = {
  time: string;
  train_no: string;
  type: string;
  is_departure: boolean;
  destinations: Array<{ name: string }>;
};

type NavitimeTimetableTarget = {
  target: "weekday" | "holiday";
  operations: Array<{ hour: number; minutes: NavitimeMinute[] }>;
};

type NavitimeResponse = {
  station: { name: string };
  timetables: NavitimeTimetableTarget[];
  detail: {
    revision: {
      weekday?: { date: string };
      holiday?: { date: string };
    };
  };
};

type TimetableEntry = {
  time: string;
  kind: string;
  dest: string;
  trainNo: string;
  isDeparture: boolean;
};

type DirectionData = {
  weekday: TimetableEntry[];
  holiday: TimetableEntry[];
};

type StationData = Record<string, DirectionData>;

function directionLabel(direction: string): string {
  return direction === "0" ? "上り方面" : "下り方面";
}

function normalizeDestination(dest: string): string {
  // 【高幡不動から各駅停車】などの隅付き括弧注記を除去（U+3010/3011）
  return dest.replace(/【[^】]*】/g, "").trim();
}

function formatTime(isoTime: string): string {
  // "2026-06-08T05:08:00+09:00" → "05:08"
  const match = /T(\d{2}):(\d{2})/.exec(isoTime);
  if (!match) throw new Error(`Unexpected time format: ${isoTime}`);
  return `${match[1]}:${match[2]}`;
}

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

async function fetchNavitime(station: string, line: string, direction: string): Promise<NavitimeResponse | null> {
  const url = `${NAVITIME_API_BASE}/${station}/${line}/${direction}?lang=ja`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`  [skip] HTTP ${res.status}: station=${station} line=${line} dir=${direction}`);
      return null;
    }
    return (await res.json()) as NavitimeResponse;
  } catch (e) {
    console.warn(`  [skip] fetch error: station=${station} line=${line} dir=${direction}: ${e}`);
    return null;
  }
}

function parseEntries(timetables: NavitimeTimetableTarget[]): {
  weekday: TimetableEntry[];
  holiday: TimetableEntry[];
} {
  const result = { weekday: [] as TimetableEntry[], holiday: [] as TimetableEntry[] };

  for (const t of timetables) {
    if (t.target !== "weekday" && t.target !== "holiday") continue;
    const entries: TimetableEntry[] = [];

    for (const op of t.operations) {
      for (const m of op.minutes) {
        const dest = normalizeDestination(m.destinations[0]?.name ?? "");
        entries.push({
          time: formatTime(m.time),
          kind: m.type,
          dest,
          trainNo: m.train_no.trim(),
          isDeparture: m.is_departure,
        });
      }
    }

    result[t.target] = entries;
  }

  return result;
}

function mergeEntries(existing: TimetableEntry[], incoming: TimetableEntry[]): TimetableEntry[] {
  const seen = new Set(existing.map((e) => e.trainNo));
  const merged = [...existing];
  for (const e of incoming) {
    if (!seen.has(e.trainNo)) {
      merged.push(e);
      seen.add(e.trainNo);
    }
  }
  merged.sort((a, b) => {
    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const raw = h * 60 + m;
      return raw < 4 * 60 ? raw + 24 * 60 : raw;
    };
    return toMin(a.time) - toMin(b.time);
  });
  return merged;
}

async function main() {
  console.log("1. keio.co.jp 駅一覧を取得中...");
  const html = await fetchText(KEIO_STATION_LIST_URL);
  const $ = load(html);

  const combos = new Map<string, { station: string; line: string; direction: string }>();
  $("a[href*='transfer-train.navitime.biz']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const match = /station=(\d+)&(?:amp;)?line=(\d+)&(?:amp;)?direction=(\d+)/.exec(href);
    if (!match) return;
    const [, station, line, direction] = match;
    if (EXCLUDED_LINES.has(line)) return;
    const key = `${station}-${line}-${direction}`;
    combos.set(key, { station, line, direction });
  });

  // station+line の一意なペアを抽出し、両方向（0と1）を試す
  const stationLinePairs = new Map<string, { station: string; line: string }>();
  for (const { station, line } of combos.values()) {
    stationLinePairs.set(`${station}-${line}`, { station, line });
  }

  // 各 station+line に対して direction=0 と direction=1 の両方を試す
  const allCombos: Array<{ station: string; line: string; direction: string }> = [];
  for (const { station, line } of stationLinePairs.values()) {
    allCombos.push({ station, line, direction: "0" });
    allCombos.push({ station, line, direction: "1" });
  }

  console.log(`   ${stationLinePairs.size} 駅+路線ペア × 2方向 = ${allCombos.length} リクエスト（井の頭線除く）`);

  console.log("2. navitime API から時刻表を取得中...");

  const stations = new Map<string, StationData>();
  let revision = { weekday: "", holiday: "" };

  let count = 0;
  for (const { station, line, direction } of allCombos) {
    count++;
    process.stdout.write(`\r   ${count}/${allCombos.length} ...`);

    await sleep(REQUEST_INTERVAL_MS);
    const data = await fetchNavitime(station, line, direction);
    if (!data) continue;

    const stationName = data.station.name;
    const dirLabel = directionLabel(direction);
    const entries = parseEntries(data.timetables);

    if (!stations.has(stationName)) {
      stations.set(stationName, {});
    }
    const stationData = stations.get(stationName)!;

    if (!stationData[dirLabel]) {
      stationData[dirLabel] = { weekday: [], holiday: [] };
    }
    // 同一駅・方向に複数の line からデータが来る場合はマージ
    stationData[dirLabel].weekday = mergeEntries(stationData[dirLabel].weekday, entries.weekday);
    stationData[dirLabel].holiday = mergeEntries(stationData[dirLabel].holiday, entries.holiday);

    // 改正日は最初に取れたものを使用（全駅同じはず）
    if (!revision.weekday && data.detail.revision.weekday?.date) {
      revision = {
        weekday: data.detail.revision.weekday.date,
        holiday: data.detail.revision.holiday?.date ?? data.detail.revision.weekday.date,
      };
    }
  }

  process.stdout.write("\n");
  console.log(`   ${stations.size} 駅のデータを取得`);

  const output = {
    generatedAt: new Date().toISOString(),
    revision,
    stations: Object.fromEntries(
      [...stations.entries()].sort(([a], [b]) => a.localeCompare(b, "ja")),
    ),
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\n完了: ${OUTPUT_PATH}`);
  console.log(`ダイヤ改正日: 平日=${revision.weekday} / 土休日=${revision.holiday}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
