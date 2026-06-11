import { describe, expect, it, vi } from "vitest";

vi.mock("../data/timetable.json", () => ({
  default: {
    generatedAt: "2026-06-11T00:00:00.000Z",
    revision: { weekday: "test-weekday", holiday: "test-holiday" },
    stations: {
      "飛田給（味の素スタジアム前）": {
        上り方面: {
          weekday: [
            { time: "05:00", kind: "急行", dest: "新宿", trainNo: "DUP", isDeparture: true },
            { time: "03:50", kind: "各駅停車", dest: "新宿", trainNo: "LATE-NIGHT", isDeparture: true },
            { time: "04:10", kind: "快速", dest: "新宿", trainNo: "PAST", isDeparture: true },
            { time: "04:30", kind: "特急", dest: "新宿", trainNo: "NEXT", isDeparture: true },
          ],
          holiday: [
            { time: "06:00", kind: "各駅停車", dest: "新宿", trainNo: "HOLIDAY", isDeparture: true },
          ],
        },
      },
    },
  },
}));

import {
  buildScheduleCandidates,
  normalizeDestination,
  normalizeKey,
  selectDiakind,
  timetableTimeToMinutes,
} from "../timetable.js";

describe("selectDiakind", () => {
  it("平日は weekday を返す", () => {
    expect(selectDiakind("2026-06-11")).toBe("weekday");
  });

  it.each(["2026-06-13", "2026-06-14"])("土日は holiday を返す: %s", (date) => {
    expect(selectDiakind(date)).toBe("holiday");
  });

  it("holiday_jp が判定する祝日は holiday を返す", () => {
    expect(selectDiakind("2026-01-01")).toBe("holiday");
  });
});

describe("normalizeKey", () => {
  it("NFKC より先に全角括弧の付加表記を除去する", () => {
    expect(normalizeKey("飛田給（味の素スタジアム前）")).toBe("飛田給");
  });

  it.each([
    ["笹塚", "笹塚"],
    ["つつじヶ丘", "つつじケ丘"],
  ])("表記揺れを正規化する: %s", (input, expected) => {
    expect(normalizeKey(input)).toBe(expected);
  });
});

describe("normalizeDestination", () => {
  it("隅付き括弧と亀甲括弧の注記を除去する", () => {
    expect(normalizeDestination("橋本【京王多摩センターから各停】〔臨時〕")).toBe("橋本");
  });
});

describe("timetableTimeToMinutes", () => {
  it("04:00 未満だけ翌日分として 24 時間を加算する", () => {
    expect(timetableTimeToMinutes("03:59")).toBe(27 * 60 + 59);
    expect(timetableTimeToMinutes("04:00")).toBe(4 * 60);
    expect(timetableTimeToMinutes("23:59")).toBe(23 * 60 + 59);
  });
});

describe("buildScheduleCandidates", () => {
  it("現在時刻以降を trainNo で重複排除し、運行日分の時刻順に返す", () => {
    const result = buildScheduleCandidates(
      "飛田給",
      "上り方面",
      "weekday",
      4 * 60 + 20,
      new Set(["DUP"]),
    );

    expect(result).toEqual([
      {
        trainId: "NEXT",
        direction: "上り方面",
        kind: "特急",
        dest: "新宿",
        scheduledMinutes: 4 * 60 + 30,
        estimatedMinutes: 4 * 60 + 30,
        delay: 0,
        source: "schedule",
      },
      {
        trainId: "LATE-NIGHT",
        direction: "上り方面",
        kind: "各駅停車",
        dest: "新宿",
        scheduledMinutes: 27 * 60 + 50,
        estimatedMinutes: 27 * 60 + 50,
        delay: 0,
        source: "schedule",
      },
    ]);
  });

  it("指定したダイヤ種別のエントリを使用する", () => {
    expect(buildScheduleCandidates("飛田給", "上り方面", "holiday", 0, new Set())).toMatchObject([
      { trainId: "HOLIDAY", source: "schedule" },
    ]);
  });

  it("駅または方向が見つからなければ空配列を返す", () => {
    expect(buildScheduleCandidates("存在しない駅", "上り方面", "weekday", 0, new Set())).toEqual([]);
    expect(buildScheduleCandidates("飛田給", "下り方面", "weekday", 0, new Set())).toEqual([]);
  });
});
