import { atomWithStorage } from "jotai/utils";
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

export const sleepSettingsAtom = atomWithStorage<SleepSettings>(
  "asamiru-sleep-settings",
  DEFAULT_SLEEP_SETTINGS,
  mergedStorage(DEFAULT_SLEEP_SETTINGS),
  { getOnInit: true },
);

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

/** スケジュール上スリープすべき時間帯か（起床時間帯の外）。空スケジュールでは自動スリープしない。 */
export function scheduleSleepingNow(now: Date, settings: SleepSettings): boolean {
  return settings.enabled && settings.windows.length > 0 && !scheduleAwakeNow(now, settings.windows);
}
