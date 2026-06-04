import { http, HttpResponse } from "msw";
import type {
  DisplayInfoResponse,
  LineStatusResponse,
  RailDeparturesResponse,
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
    "トリニティ・シタデル方面": [
      // きさらぎライナーバッジの特別スタイルを確認できるよう先頭に置く
      { time: minutesLater(1), kind: "きさらぎライナー", dest: "シタデル", delay: 0, source: "realtime" },
      { time: minutesLater(6), kind: "準特急", dest: "トリニティ", source: "realtime" },
      { time: minutesLater(14), kind: "各停", dest: "百鬼夜行学園前", source: "schedule" },
    ],
    "ゲヘナ・ミレニアム方面": [
      { time: minutesLater(5), scheduled: minutesLater(1), kind: "急行", dest: "ゲヘナ", delay: 4, source: "realtime" },
      { time: minutesLater(8), kind: "各停", dest: "ミレニアム", source: "realtime" },
      { time: minutesLater(17), kind: "準特急", dest: "アビドス", source: "schedule" },
    ],
  };
}

// ─── 運行情報 ──────────────────────────────────────────────────────────────

const MOCK_LINE_STATUS: LineStatusResponse = {
  lines: [
    {
      name: "きさらぎ高速鉄道",
      status: "遅延",
      level: "warn",
      note: "折り返し運転を実施しています",
      sourceUrl: "#",
      checkedAt: "",
    },
    {
      name: "きさらぎ市営地下鉄",
      status: "平常運転",
      level: "ok",
      sourceUrl: "#",
      checkedAt: "",
    },
    {
      name: "トリニティ連絡鉄道",
      status: "平常運転",
      level: "ok",
      sourceUrl: "#",
      checkedAt: "",
    },
    {
      name: "ゲヘナ急行電鉄",
      status: "平常運転",
      level: "ok",
      sourceUrl: "#",
      checkedAt: "",
    },
  ],
  source: "yahoo-transit",
  fetchedAt: "",
};

// ─── ハンドラー定義 ────────────────────────────────────────────────────────

export const handlers = [
  // 次発情報: boardingStation は常に "きさらぎ駅"（設定値は無視）、displayCount のみ反映
  http.post("*/api/rail/departures", async ({ request }) => {
    type DepartureRequest = { boardingStation?: string; displayCount?: number };
    const body = (await request.json().catch(() => ({}))) as DepartureRequest;
    const departures = buildDepartures();
    const response: RailDeparturesResponse = {
      station: "きさらぎ駅",
      departures: Object.fromEntries(
        Object.entries(departures).map(([dir, deps]) => [
          dir,
          deps.slice(0, body.displayCount ?? deps.length),
        ]),
      ),
    };
    await new Promise((r) => setTimeout(r, 300));
    return HttpResponse.json(response);
  }),

  // 運行情報: 架空路線を固定で返す（checkedAt / fetchedAt は現在時刻で上書き）
  http.post("*/api/rail/line-status", async () => {
    const now = new Date().toISOString();
    const response: LineStatusResponse = {
      ...MOCK_LINE_STATUS,
      fetchedAt: now,
      lines: MOCK_LINE_STATUS.lines.map((l) => ({ ...l, checkedAt: now })),
    };
    await new Promise((r) => setTimeout(r, 200));
    return HttpResponse.json(response);
  }),

  // 天気: 実 Open-Meteo API にパススルーし、場所名だけ "キヴォトス" に上書き
  // fetchWeather は _location フィールドがあれば locationName より優先する
  http.get("https://api.open-meteo.com/v1/forecast", async ({ request }) => {
    const response = await fetch(request);
    const data = (await response.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...data, _location: "キヴォトス" });
  }),

  // モニター連動: enabled:false で connectWithRetry をリトライなし終端させる
  http.get("*/api/system/display", () => {
    const response: DisplayInfoResponse = { enabled: false };
    return HttpResponse.json(response);
  }),
];
