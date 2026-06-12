import { describe, expect, it } from "vitest";
import { buildCalendarAgenda, buildMonth } from "./CalendarCard";

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

describe("buildCalendarAgenda", () => {
  const now = new Date("2026-06-11T08:00:00+09:00");

  it("今日・明日・それ以降の時刻付き予定を JST で振り分ける", () => {
    const agenda = buildCalendarAgenda(
      [
        {
          title: "今日の予定",
          start: "2026-06-11T09:30:00.000+09:00",
          end: "2026-06-11T10:00:00.000+09:00",
          allDay: false,
        },
        {
          title: "明日の予定",
          start: "2026-06-12T14:00:00.000+09:00",
          end: "2026-06-12T15:00:00.000+09:00",
          allDay: false,
        },
        {
          title: "来週の予定",
          start: "2026-06-18T19:00:00.000+09:00",
          end: "2026-06-18T20:00:00.000+09:00",
          allDay: false,
        },
      ],
      now,
    );

    expect(agenda.map((day) => day.label)).toEqual(["今日", "明日", "6/18(木)"]);
    expect(agenda[0]?.events).toEqual([expect.objectContaining({ title: "今日の予定", time: "09:30" })]);
    expect(agenda[1]?.events).toEqual([expect.objectContaining({ title: "明日の予定", time: "14:00" })]);
    expect(agenda[2]?.events).toEqual([expect.objectContaining({ title: "来週の予定", time: "19:00" })]);
  });

  it("終日予定には時刻を付けない", () => {
    const agenda = buildCalendarAgenda(
      [
        {
          title: "終日予定",
          start: "2026-06-11T00:00:00.000+09:00",
          end: "2026-06-12T00:00:00.000+09:00",
          allDay: true,
        },
      ],
      now,
    );

    expect(agenda[0]?.events[0]).toEqual(expect.objectContaining({ title: "終日予定", time: undefined }));
  });

  it("終了済みの予定を除外する", () => {
    const agenda = buildCalendarAgenda(
      [
        {
          title: "昨日の予定",
          start: "2026-06-10T09:00:00.000+09:00",
          end: "2026-06-10T10:00:00.000+09:00",
          allDay: false,
        },
      ],
      now,
    );

    expect(agenda.flatMap((day) => day.events)).toEqual([]);
  });

  it("前日開始の時刻付き予定は今日へ持ち越さない", () => {
    const agenda = buildCalendarAgenda(
      [
        {
          title: "深夜の予定",
          start: "2026-06-10T23:30:00.000+09:00",
          end: "2026-06-11T00:30:00.000+09:00",
          allDay: false,
        },
      ],
      now,
    );

    expect(agenda).toEqual([]);
  });

  it("複数日にまたがる終日予定を今日の予定として1件だけ表示する", () => {
    const agenda = buildCalendarAgenda(
      [
        {
          title: "連休",
          start: "2026-06-10T00:00:00.000+09:00",
          end: "2026-06-14T00:00:00.000+09:00",
          allDay: true,
        },
      ],
      now,
    );

    expect(agenda).toEqual([
      expect.objectContaining({
        label: "今日",
        events: [expect.objectContaining({ title: "連休", time: undefined })],
      }),
    ]);
  });

  it("予定は日付順で最大5件まで表示する", () => {
    const events = Array.from({ length: 7 }, (_, index) => ({
      title: `予定${index + 1}`,
      start: `2026-06-${String(11 + index).padStart(2, "0")}T10:00:00.000+09:00`,
      end: `2026-06-${String(11 + index).padStart(2, "0")}T11:00:00.000+09:00`,
      allDay: false,
    }));

    const agenda = buildCalendarAgenda(events, now);

    expect(agenda.flatMap((day) => day.events).map((event) => event.title)).toEqual([
      "予定1",
      "予定2",
      "予定3",
      "予定4",
      "予定5",
    ]);
  });
});
