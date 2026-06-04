import { http, HttpResponse } from "msw";
import type {
  DisplayInfoResponse,
  LineStatusResponse,
  RailDeparturesResponse,
  WatchedLine,
} from "@asamiru/shared";

// ─── 次発情報 ──────────────────────────────────────────────────────────────

/**
 * 現在時刻を起点に n 分後の発車時刻文字列 "HH:MM" を返す。
 * デモが何時に開かれても直近発車に見えるようにする。
 */
function minutesLater(offset: number): string {
  const d = new Date(Date.now() + offset * 60_000);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// モジュールロード時に固定せず、リクエストごとに組み立てる。
// React Query が90秒ごとに refetch しても常に「現在時刻から n 分後」になる。
function buildDepartures(): RailDeparturesResponse["departures"] {
  return {
    新宿方面: [
      { time: minutesLater(2), kind: "急行", dest: "新宿", delay: 0, source: "realtime" },
      { time: minutesLater(7), kind: "各停", dest: "新宿", source: "realtime" },
      { time: minutesLater(13), kind: "準特急", dest: "新線新宿", source: "schedule" },
    ],
    調布・橋本方面: [
      { time: minutesLater(3), kind: "急行", dest: "橋本", source: "realtime" },
      { time: minutesLater(9), kind: "各停", dest: "調布", delay: 3, source: "realtime" },
      { time: minutesLater(15), kind: "準特急", dest: "高尾山口", source: "schedule" },
    ],
  };
}

// ─── 運行情報 ──────────────────────────────────────────────────────────────

type LineStatusRequest = { lines: WatchedLine[] };

/**
 * リクエスト body の lines を基準に応答を構築する（レビュー #5 対応）。
 * 先頭1件だけ warn、残りは ok にしてデモの見栄えを確保する。
 */
function buildLineStatusResponse(lines: WatchedLine[]): LineStatusResponse {
  const now = new Date().toISOString();
  return {
    lines: lines.map((line, i) =>
      i === 0
        ? {
            name: line.name,
            status: "遅延",
            level: "warn",
            note: "一部列車に最大10分の遅れが出ています（デモデータ）",
            sourceUrl: line.yahooUrl,
            checkedAt: now,
          }
        : {
            name: line.name,
            status: "平常運転",
            level: "ok",
            sourceUrl: line.yahooUrl,
            checkedAt: now,
          },
    ),
    source: "yahoo-transit",
    fetchedAt: now,
  };
}

// ─── ハンドラー定義 ────────────────────────────────────────────────────────

export const handlers = [
  // 次発情報: body の boardingStation / displayCount を station 名に反映
  http.post("*/api/rail/departures", async ({ request }) => {
    type DepartureRequest = { boardingStation?: string; displayCount?: number };
    const body = (await request.json().catch(() => ({}))) as DepartureRequest;
    const departures = buildDepartures();
    const response: RailDeparturesResponse = {
      station: body.boardingStation ?? "明大前",
      departures: Object.fromEntries(
        Object.entries(departures).map(([dir, deps]) => [
          dir,
          deps.slice(0, body.displayCount ?? deps.length),
        ]),
      ),
    };
    // 少し待ってリアルっぽく見せる
    await new Promise((r) => setTimeout(r, 300));
    return HttpResponse.json(response);
  }),

  // 運行情報: body の lines を基準に返す
  http.post("*/api/rail/line-status", async ({ request }) => {
    const body = (await request.json().catch(() => ({ lines: [] }))) as LineStatusRequest;
    const lines: WatchedLine[] = Array.isArray(body.lines) ? body.lines : [];
    await new Promise((r) => setTimeout(r, 200));
    return HttpResponse.json(buildLineStatusResponse(lines));
  }),

  // モニター連動: enabled:false で connectWithRetry をリトライなし終端させる
  http.get("*/api/system/display", () => {
    const response: DisplayInfoResponse = { enabled: false };
    return HttpResponse.json(response);
  }),
];
