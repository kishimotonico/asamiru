import type { CalendarEvent, CalendarEventsResponse } from "@asamiru/shared";

// ─── 架空カレンダー予定 ────────────────────────────────────────────────────

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 現在時刻を起点に JST 日付を求める。
 */
function jstDateKey(date: Date, dayOffset: number): string {
  const shifted = new Date(date.getTime() + dayOffset * 24 * 60 * 60 * 1000 + JST_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/**
 * JST の日付・時刻から ISO 文字列（UTC）を組み立てる。
 */
function jstDateTime(dateKey: string, hour: number, minute: number): string {
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`).toISOString();
}

/**
 * 架空カレンダーの予定を生成する。
 * 今日2件・それ以降1件を、デモの架空地名の世界観に合わせて返す。
 * リクエストごとに呼ぶことで、何時に開いても直近の予定として見える。
 */
export function buildDemoCalendarEvents(): CalendarEventsResponse {
  const now = new Date();
  const today = jstDateKey(now, 0);
  const nextWeek = jstDateKey(now, 7);

  const events: CalendarEvent[] = [
    {
      title: "芸術学園 始業式",
      start: jstDateTime(today, 8, 30),
      end: jstDateTime(today, 9, 0),
      allDay: false,
    },
    {
      title: "古書館 返却期限",
      start: jstDateTime(today, 0, 0),
      end: jstDateTime(jstDateKey(now, 1), 0, 0),
      allDay: true,
    },
    {
      title: "ボーダーランド遊園地 イベント",
      start: jstDateTime(nextWeek, 0, 0),
      end: jstDateTime(jstDateKey(now, 8), 0, 0),
      allDay: true,
    },
  ];

  return { events, checkedAt: now.toISOString() };
}
