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
const STORAGE_KEY =
  import.meta.env.VITE_DEMO_MODE === "true"
    ? "asamiru-calendar-settings-demo"
    : "asamiru-calendar-settings";

const DEFAULTS =
  import.meta.env.VITE_DEMO_MODE === "true" ? DEMO_CALENDAR_SETTINGS : DEFAULT_CALENDAR_SETTINGS;

export const calendarSettingsAtom = atomWithStorage<CalendarSettings>(
  STORAGE_KEY,
  DEFAULTS,
  mergedStorage(DEFAULTS),
  { getOnInit: true },
);
