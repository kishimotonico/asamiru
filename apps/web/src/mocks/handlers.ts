import { http, HttpResponse, bypass } from "msw";
import type { CalendarEventsResponse, DisplayInfoResponse, RailDeparturesResponse } from "@asamiru/shared";
import type { WatchedLine } from "@asamiru/shared";
import { buildDemoCalendarEvents } from "../demo/calendarDemoData";
import { buildDemoDepartures, buildDemoLineStatus } from "../demo/railDemoData";

// ─── ハンドラー定義 ────────────────────────────────────────────────────────

export const handlers = [
  // 次発情報: boardingStation を尊重してそのままエコー、displayCount のみ反映
  http.post("*/api/rail/departures", async ({ request }) => {
    type DepartureRequest = { boardingStation?: string; displayCount?: number };
    const body = (await request.json().catch(() => ({}))) as DepartureRequest;
    const departures = buildDemoDepartures();
    const response: RailDeparturesResponse = {
      station: body.boardingStation ?? "きさらぎ駅",
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

  // 運行情報: リクエストの lines を尊重して架空ステータスを返す
  // API クライアント（data/lineStatus.ts）は `{ lines }` で POST する
  http.post("*/api/rail/line-status", async ({ request }) => {
    type LineStatusRequest = { lines?: WatchedLine[] };
    const body = (await request.json().catch(() => ({}))) as LineStatusRequest;
    const response = buildDemoLineStatus(body.lines ?? []);
    await new Promise((r) => setTimeout(r, 200));
    return HttpResponse.json(response);
  }),

  // カレンダー予定: icsUrls の中身は問わず、直近14日内の架空の予定を返す
  // API クライアント（data/calendarEvents.ts）は `{ icsUrls, days }` で POST する
  http.post("*/api/calendar/events", async () => {
    const response: CalendarEventsResponse = buildDemoCalendarEvents();
    await new Promise((r) => setTimeout(r, 200));
    return HttpResponse.json(response);
  }),

  // 天気: 実 Open-Meteo API にパススルーし、場所名だけ "キヴォトス" に上書き
  // fetchWeather は _location フィールドがあれば locationName より優先する
  http.get("https://api.open-meteo.com/v1/forecast", async ({ request }) => {
    const response = await fetch(bypass(request));
    const data = (await response.json()) as Record<string, unknown>;
    return HttpResponse.json({ ...data, _location: "キヴォトス" });
  }),

  // モニター連動: enabled:false で connectWithRetry をリトライなし終端させる
  http.get("*/api/system/display", () => {
    const response: DisplayInfoResponse = { enabled: false };
    return HttpResponse.json(response);
  }),
];
