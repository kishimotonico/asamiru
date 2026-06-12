import { atomWithStorage } from "jotai/utils";
import { mergedStorage } from "./mergedStorage";

export type CalendarSettings = {
  icsUrls: string[];
};

const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  icsUrls: [],
};

/**
 * デモビルドでは MSW が POST /api/calendar/events を横取りするため、
 * icsUrls の中身は実際にフェッチされず識別子としてのみ使われる。
 * CalendarDataCard は icsUrls が空だとクエリを発行しないため、
 * カレンダーカードに予定を表示するにはダミー URL を1件既定で入れておく。
 */
const DEMO_CALENDAR_SETTINGS: CalendarSettings = {
  icsUrls: ["https://calendar.example/kisaragi-school.ics"],
};

/**
 * localStorage key はビルドモードで分離する。
 * mergedStorage は保存値をデフォルトより優先するため、同一オリジンに
 * 本番設定が残っていると、デモのダミー URL が本番の予定取得に混入しうる
 * （またはその逆でデモの予定が表示されなくなる）。
 * key を分けて本番／デモのストレージを完全分離する。
 */
export const CALENDAR_SETTINGS_STORAGE_KEY =
  import.meta.env.VITE_DEMO_MODE === "true"
    ? "asamiru-calendar-settings-demo"
    : "asamiru-calendar-settings";

export function isCalendarSettings(value: unknown): value is Partial<CalendarSettings> {
  if (!isRecord(value)) return false;

  return (
    !hasOwn(value, "icsUrls") ||
    (Array.isArray(value.icsUrls) && value.icsUrls.every((url) => typeof url === "string"))
  );
}

const DEFAULTS =
  import.meta.env.VITE_DEMO_MODE === "true" ? DEMO_CALENDAR_SETTINGS : DEFAULT_CALENDAR_SETTINGS;

export const calendarSettingsAtom = atomWithStorage<CalendarSettings>(
  CALENDAR_SETTINGS_STORAGE_KEY,
  DEFAULTS,
  mergedStorage(DEFAULTS),
  { getOnInit: true },
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
