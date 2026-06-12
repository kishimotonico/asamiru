import { atomWithStorage } from "jotai/utils";
import { hasOwn, isNumber, isRecord } from "../lib/guards";
import { mergedStorage } from "../settings/mergedStorage";

/** 起きてる時間帯（awake window）。days は 0(日)-6(土)、start/end は "HH:MM"。 */
export type SleepWindow = {
  id: string;
  days: number[];
  start: string;
  end: string;
};

export type SleepSettings = {
  /** スケジュールによる自動スリープのON/OFF */
  enabled: boolean;
  /** 起きてる時間帯。ここに該当しない時刻はスリープ対象。 */
  windows: SleepWindow[];
  /** 操作後、自動スリープへ戻るまでの分 */
  manualWakeDurationMin: number;
};

export const DEFAULT_SLEEP_SETTINGS: SleepSettings = {
  enabled: true,
  windows: [{ id: "default-weekday-morning", days: [1, 2, 3, 4, 5], start: "06:00", end: "09:00" }],
  manualWakeDurationMin: 15,
};

export const SLEEP_SETTINGS_STORAGE_KEY = "asamiru-sleep-settings";

export function isSleepSettings(value: unknown): value is Partial<SleepSettings> {
  if (!isRecord(value)) return false;

  return (
    (!hasOwn(value, "enabled") || typeof value.enabled === "boolean") &&
    (!hasOwn(value, "windows") ||
      (Array.isArray(value.windows) && value.windows.every(isSleepWindow))) &&
    (!hasOwn(value, "manualWakeDurationMin") || isNumber(value.manualWakeDurationMin))
  );
}

export const sleepSettingsAtom = atomWithStorage<SleepSettings>(
  SLEEP_SETTINGS_STORAGE_KEY,
  DEFAULT_SLEEP_SETTINGS,
  mergedStorage(DEFAULT_SLEEP_SETTINGS),
  { getOnInit: true },
);

function isSleepWindow(value: unknown): value is SleepWindow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.days) &&
    value.days.every(isNumber) &&
    typeof value.start === "string" &&
    typeof value.end === "string"
  );
}

/** "HH:MM" を 0-1439 の分に変換。不正値は NaN。 */
function parseHmToMinutes(hm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * 現在時刻がいずれかの起床時間帯に入っているか（純粋関数）。
 * 日付またぎ（例: 22:00-06:00）に対応する。境界仕様はこの関数に集約する。
 */
export function scheduleAwakeNow(now: Date, windows: SleepWindow[]): boolean {
  const t = now.getHours() * 60 + now.getMinutes();
  const d = now.getDay();

  for (const w of windows) {
    const s = parseHmToMinutes(w.start);
    const e = parseHmToMinutes(w.end);
    if (Number.isNaN(s) || Number.isNaN(e) || s === e) continue;

    if (s < e) {
      // 同日内
      if (w.days.includes(d) && s <= t && t < e) return true;
    } else {
      // 日付またぎ（開始日基準）
      if (w.days.includes(d) && t >= s) return true; // 夜側
      if (w.days.includes((d + 6) % 7) && t < e) return true; // 朝側（前日の窓の継続）
    }
  }
  return false;
}

/** 起床時間帯として機能する window か（曜日が1つ以上 ＆ 有効な時刻幅を持つ）。 */
export function isEffectiveWindow(w: SleepWindow): boolean {
  if (w.days.length === 0) return false;
  const s = parseHmToMinutes(w.start);
  const e = parseHmToMinutes(w.end);
  return !Number.isNaN(s) && !Number.isNaN(e) && s !== e;
}

/**
 * スケジュール上スリープすべき時間帯か（起床時間帯の外）。
 * 有効な起床時間帯が1つも無い場合（空・全曜日OFF・無効時刻のみ）は自動スリープしない。
 */
export function scheduleSleepingNow(now: Date, settings: SleepSettings): boolean {
  return settings.enabled && settings.windows.some(isEffectiveWindow) && !scheduleAwakeNow(now, settings.windows);
}

/**
 * now より後に始まる、最も近いスケジュール起床帯の開始時刻（epoch ms）。
 * 有効な起床帯が1つも無ければ null。最大7日先まで探索する。
 *
 * 日付またぎ窓（例 22:00-06:00）の開始は start 側（夜側）。重複・隣接する窓は
 * 連続した1つの起床帯として扱い、その途中から始まる窓の start は候補にしない
 * （直前がスリープ帯である「本当の sleep→awake 遷移」だけを採る）。
 * 起床帯の途中で forceSleep した場合は、今の連続帯では戻らず次の帯の開始で戻る。
 */
export function nextScheduleWakeStartAfter(now: Date, windows: SleepWindow[]): number | null {
  const effectiveWindows = windows.filter(isEffectiveWindow);
  if (effectiveWindows.length === 0) return null;

  const nowMs = now.getTime();
  let earliest: number | null = null;

  // 今日から7日先（合計8日分）の各窓の start 時刻を列挙し、now より後で最小のものを返す
  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidate = new Date(now);
    candidate.setHours(0, 0, 0, 0);
    candidate.setDate(candidate.getDate() + dayOffset);

    for (const w of effectiveWindows) {
      const [startHStr, startMStr] = w.start.split(":");
      const startH = Number(startHStr);
      const startM = Number(startMStr);
      const startDate = new Date(candidate);
      startDate.setHours(startH, startM, 0, 0);

      // start 時刻がその日の days に含まれるかチェック
      if (!w.days.includes(startDate.getDay())) continue;

      const startMs = startDate.getTime();
      // 直前がスリープ帯である start だけを採用する。重複・隣接窓では連続帯の
      // 途中から始まる窓の start（直前が既に起床帯）を除外し、本当の sleep→awake 遷移点だけを拾う。
      if (startMs > nowMs && !scheduleAwakeNow(new Date(startMs - 1), windows)) {
        if (earliest === null || startMs < earliest) {
          earliest = startMs;
        }
      }
    }
  }

  return earliest;
}
