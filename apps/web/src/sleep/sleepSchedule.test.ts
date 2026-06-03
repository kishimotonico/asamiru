import { describe, expect, it } from "vitest";
import {
  isEffectiveWindow,
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
