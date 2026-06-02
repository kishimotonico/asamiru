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

// keio.co.jp の駅一覧トップページに載っていない組み合わせを手動で追加。
const EXTRA_STATION_LINE_PAIRS: Array<{ station: string; line: string; label: string }> = [
  // 新線新宿 (下り: 都営新宿線直通): station=4254 は新宿と同一 ID。
  // navitime は station.name="新宿" で返すため、取得後に STATION_ALIASES でキーを追加する。
  { station: "4254", line: "8", label: "新線新宿 下り (line=8)" },
];

// navitime の駅名 → 追加するエイリアス駅名のマッピング。
// 新線新宿は navitime 上では「新宿」として扱われるため、同一データを「新線新宿」キーでも保存する。
const STATION_ALIASES: Record<string, string[]> = {
  "新宿": ["新線新宿"],
};

// アプリが対応する全乗車駅（KEIO_STATIONS と同期すること）
const EXPECTED_STATIONS = [
  "新宿", "笹塚", "代田橋", "明大前", "下高井戸", "桜上水", "上北沢",
  "八幡山", "芦花公園", "千歳烏山", "仙川", "つつじヶ丘", "柴崎", "国領",
  "布田", "調布", "西調布", "飛田給", "武蔵野台", "多磨霊園", "東府中",
  "府中", "分倍河原", "中河原", "聖蹟桜ヶ丘", "百草園", "高幡不動", "南平",
  "平山城址公園", "長沼", "北野", "京王八王子", "新線新宿", "初台", "幡ヶ谷",
  "京王片倉", "山田", "めじろ台", "狭間", "高尾", "高尾山口",
  "京王多摩川", "京王稲田堤", "京王よみうりランド", "稲城", "若葉台",
  "京王永山", "京王多摩センター", "京王堀之内", "南大沢", "多摩境", "橋本",
];

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
  return dest
    .replace(/【[^】]*】/g, "")  // 隅付き括弧 U+3010/3011
    .replace(/〔[^〕]*〕/g, "")  // 亀甲括弧 U+3014/3015
    .trim();
}

/**
 * ヶ/ケ・互換漢字・全角括弧付加表記（飛田給（味の素スタジアム前）など）を正規化。
 * 全角括弧除去は NFKC より先に行うこと（NFKC が （ を ( に変換するため）。
 */
function normalizeKey(name: string): string {
  return name
    .replace(/（[^）]*）/g, "")
    .normalize("NFKC")
    .replace(/ヶ/g, "ケ")
    .replace(/ヵ/g, "カ")
    .trim();
}

function formatTime(isoTime: string): string {
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

async function fetchNavitime(
  station: string,
  line: string,
  direction: string,
): Promise<NavitimeResponse | null> {
  const url = `${NAVITIME_API_BASE}/${station}/${line}/${direction}?lang=ja`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (res.status === 502 || res.status === 404) {
    // 終端駅の逆方向など、存在しない組み合わせは正常にスキップ
    return null;
  }
  if (!res.ok) {
    // 想定外のエラーは fail-fast
    throw new Error(`HTTP ${res.status}: ${url}`);
  }
  return (await res.json()) as NavitimeResponse;
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

/** 期待駅がすべて取得済み stations に含まれるかを検証し、欠損があれば非ゼロ終了する */
function verifyCoverage(stations: Map<string, StationData>): void {
  const stationKeys = [...stations.keys()];
  const missing: string[] = [];

  for (const expected of EXPECTED_STATIONS) {
    const found = stationKeys.some((k) => normalizeKey(k) === normalizeKey(expected));
    if (!found) missing.push(expected);
  }

  if (missing.length > 0) {
    console.error(`\n[ERROR] 期待する駅が時刻表に含まれていません:`);
    for (const m of missing) console.error(`  - ${m}`);
    console.error(`\n  EXTRA_STATION_LINE_PAIRS の追加、またはスクレイピング元を確認してください。`);
    process.exit(1);
  }

  console.log(`   カバレッジ検証 OK: ${EXPECTED_STATIONS.length} 駅すべて確認`);
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

  // 手動追加分を統合
  for (const { station, line } of EXTRA_STATION_LINE_PAIRS) {
    const key = `${station}-${line}`;
    if (!stationLinePairs.has(key)) {
      stationLinePairs.set(key, { station, line });
    }
  }

  const allCombos: Array<{ station: string; line: string; direction: string }> = [];
  for (const { station, line } of stationLinePairs.values()) {
    allCombos.push({ station, line, direction: "0" });
    allCombos.push({ station, line, direction: "1" });
  }

  console.log(`   ${stationLinePairs.size} 駅+路線ペア × 2方向 = ${allCombos.length} リクエスト`);

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

    // 本駅名 + エイリアス名の両方にデータを書き込む
    const targetNames = [stationName, ...(STATION_ALIASES[stationName] ?? [])];
    for (const name of targetNames) {
      if (!stations.has(name)) {
        stations.set(name, {});
      }
      const stationData = stations.get(name)!;

      if (!stationData[dirLabel]) {
        stationData[dirLabel] = { weekday: [], holiday: [] };
      }
      stationData[dirLabel].weekday = mergeEntries(stationData[dirLabel].weekday, entries.weekday);
      stationData[dirLabel].holiday = mergeEntries(stationData[dirLabel].holiday, entries.holiday);
    }

    if (!revision.weekday && data.detail.revision.weekday?.date) {
      revision = {
        weekday: data.detail.revision.weekday.date,
        holiday: data.detail.revision.holiday?.date ?? data.detail.revision.weekday.date,
      };
    }
  }

  process.stdout.write("\n");
  console.log(`   ${stations.size} 駅のデータを取得`);

  console.log("3. カバレッジを検証中...");
  verifyCoverage(stations);

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
