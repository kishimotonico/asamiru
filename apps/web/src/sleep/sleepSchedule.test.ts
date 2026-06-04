import { describe, expect, it } from "vitest";
import {
  isEffectiveWindow,
  nextScheduleWakeStartAfter,
  scheduleAwakeNow,
  scheduleSleepingNow,
  type SleepSettings,
  type SleepWindow,
} from "./sleepSettingsAtom";

// 2026-06-01 は月曜（getDay()===1）、2026-06-06 は土曜（6）、2026-06-07 は日曜（0）
const MON = (h: number, m = 0) => new Date(2026, 5, 1, h, m);
const SAT = (h: number, m = 0) => new Date(2026, 5, 6, h, m);
const SUN = (h: number, m = 0) => new Date(2026, 5, 7, h, m);

describe("scheduleAwakeNow", () => {
  const weekdayMorning: SleepWindow[] = [{ id: "w", days: [1, 2, 3, 4, 5], start: "06:00", end: "09:00" }];

  it("同日内の起床帯を判定する", () => {
    expect(scheduleAwakeNow(MON(7), weekdayMorning)).toBe(true);
    expect(scheduleAwakeNow(MON(5, 59), weekdayMorning)).toBe(false);
    expect(scheduleAwakeNow(MON(9), weekdayMorning)).toBe(false); // end は排他
  });

  it("対象外の曜日は起床帯にしない", () => {
    expect(scheduleAwakeNow(SAT(7), weekdayMorning)).toBe(false);
  });

  it("日付またぎ（22:00-06:00）の夜側・朝側を判定する", () => {
    const overnight: SleepWindow[] = [{ id: "n", days: [6], start: "22:00", end: "06:00" }];
    // 土曜の窓 = 土 22:00 〜 日 06:00
    expect(scheduleAwakeNow(SAT(23), overnight)).toBe(true); // 夜側（開始日=土）
    expect(scheduleAwakeNow(SUN(5), overnight)).toBe(true); // 朝側（前日=土の窓の継続）
    expect(scheduleAwakeNow(SUN(7), overnight)).toBe(false);
    expect(scheduleAwakeNow(SAT(21), overnight)).toBe(false);
  });
});

describe("isEffectiveWindow", () => {
  it("曜日と有効な時刻幅があれば有効", () => {
    expect(isEffectiveWindow({ id: "a", days: [1], start: "06:00", end: "09:00" })).toBe(true);
  });
  it("曜日が空・時刻が同値・不正なら無効", () => {
    expect(isEffectiveWindow({ id: "a", days: [], start: "06:00", end: "09:00" })).toBe(false);
    expect(isEffectiveWindow({ id: "a", days: [1], start: "06:00", end: "06:00" })).toBe(false);
    expect(isEffectiveWindow({ id: "a", days: [1], start: "x", end: "09:00" })).toBe(false);
  });
});

describe("scheduleSleepingNow", () => {
  const base: SleepSettings = {
    enabled: true,
    windows: [{ id: "w", days: [1, 2, 3, 4, 5], start: "06:00", end: "09:00" }],
    manualWakeDurationMin: 15,
  };

  it("enabled=false なら常にスリープしない", () => {
    expect(scheduleSleepingNow(MON(12), { ...base, enabled: false })).toBe(false);
  });

  it("有効な窓が無ければスリープしない", () => {
    expect(scheduleSleepingNow(MON(12), { ...base, windows: [] })).toBe(false);
  });

  it("起床帯の外ならスリープ、中ならしない", () => {
    expect(scheduleSleepingNow(MON(12), base)).toBe(true);
    expect(scheduleSleepingNow(MON(7), base)).toBe(false);
  });
});

// --- nextScheduleWakeStartAfter ---

describe("nextScheduleWakeStartAfter", () => {
  // 月曜 06:00-09:00 の1窓
  const monWin: SleepWindow[] = [{ id: "w", days: [1], start: "06:00", end: "09:00" }];

  it("同日先に窓の start がある場合、それを返す", () => {
    // 月曜 05:00 → 同日 06:00 が next
    const now = MON(5, 0);
    const result = nextScheduleWakeStartAfter(now, monWin);
    expect(result).toBe(new Date(2026, 5, 1, 6, 0).getTime());
  });

  it("既に起床帯を過ぎた場合、翌週の窓を返す", () => {
    // 月曜 10:00（窓終了後）→ 翌週月曜 06:00
    const now = MON(10, 0);
    const result = nextScheduleWakeStartAfter(now, monWin);
    const nextMonday = new Date(2026, 5, 8, 6, 0); // 2026-06-08 は月曜
    expect(result).toBe(nextMonday.getTime());
  });

  it("起床帯の途中からは次の窓 start を返す（今の窓の start は過去）", () => {
    // 月曜 07:00（窓中）→ 今の窓の start（06:00）は過去 → 翌週月曜 06:00
    const now = MON(7, 0);
    const result = nextScheduleWakeStartAfter(now, monWin);
    const nextMonday = new Date(2026, 5, 8, 6, 0);
    expect(result).toBe(nextMonday.getTime());
  });

  it("日付またぎ窓（土22:00-日06:00）の開始は start 側（土22:00）を返す", () => {
    // 土曜 21:00 → 土曜 22:00（start 側）が next
    const overnight: SleepWindow[] = [{ id: "n", days: [6], start: "22:00", end: "06:00" }];
    const now = SAT(21, 0);
    const result = nextScheduleWakeStartAfter(now, overnight);
    expect(result).toBe(new Date(2026, 5, 6, 22, 0).getTime()); // 2026-06-06 土曜 22:00
  });

  it("有効窓が無ければ null を返す", () => {
    expect(nextScheduleWakeStartAfter(MON(7), [])).toBeNull();
  });

  it("曜日が空の窓は無効扱いで null を返す", () => {
    const invalidWin: SleepWindow[] = [{ id: "x", days: [], start: "06:00", end: "09:00" }];
    expect(nextScheduleWakeStartAfter(MON(7), invalidWin)).toBeNull();
  });

  it("複数窓があるとき、最も近い start を返す", () => {
    // 月曜 06:00-09:00 と 火曜 06:00-09:00
    const twoWins: SleepWindow[] = [
      { id: "mon", days: [1], start: "06:00", end: "09:00" },
      { id: "tue", days: [2], start: "06:00", end: "09:00" },
    ];
    // 月曜 05:00 → 同日 06:00 が最近
    const now = MON(5, 0);
    const result = nextScheduleWakeStartAfter(now, twoWins);
    expect(result).toBe(new Date(2026, 5, 1, 6, 0).getTime());
  });
});
