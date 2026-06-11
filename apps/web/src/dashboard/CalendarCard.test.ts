import { describe, expect, it } from "vitest";
import { buildMonth } from "./CalendarCard";

describe("buildMonth", () => {
  it("月初が日曜の月は先頭の空白セルが0個になる（2026年2月）", () => {
    const today = new Date(2026, 1, 1); // 2026-02-01 は日曜
    const { year, month, days } = buildMonth(today);

    expect(year).toBe(2026);
    expect(month).toBe(1);
    expect(days[0]).toEqual({ date: 1, isToday: true });
    expect(days).toHaveLength(28); // 2026年2月は28日（先頭空白0）
  });

  it("月初が月曜の月は先頭に日曜分の空白セルが1個入る（2026年6月）", () => {
    const today = new Date(2026, 5, 11); // 2026-06-01 は月曜、今日は11日
    const { year, month, days } = buildMonth(today);

    expect(year).toBe(2026);
    expect(month).toBe(5);
    expect(days[0]).toBeNull();
    expect(days).toHaveLength(1 + 30); // 先頭空白1 + 30日

    const day1 = days[1];
    expect(day1).toEqual({ date: 1, isToday: false });
  });

  it("today に該当する日だけ isToday: true になる", () => {
    const today = new Date(2026, 5, 11); // 6月11日
    const { days } = buildMonth(today);

    const todays = days.filter((d) => d?.isToday);
    expect(todays).toHaveLength(1);
    expect(todays[0]).toEqual({ date: 11, isToday: true });
  });

  it("月末日が today の場合も isToday が立つ（月またぎの代表ケース）", () => {
    const today = new Date(2026, 5, 30); // 6月30日（最終日）
    const { days } = buildMonth(today);

    const last = days[days.length - 1];
    expect(last).toEqual({ date: 30, isToday: true });
  });

  it("11月（月初が日曜）は空白なしで30日分になる", () => {
    const today = new Date(2026, 10, 15); // 2026-11-01 は日曜
    const { year, month, days } = buildMonth(today);

    expect(year).toBe(2026);
    expect(month).toBe(10);
    expect(days[0]).toEqual({ date: 1, isToday: false });
    expect(days).toHaveLength(30);

    const todays = days.filter((d) => d?.isToday);
    expect(todays).toEqual([{ date: 15, isToday: true }]);
  });
});
