import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../data/timetable.json", () => ({
  default: {
    generatedAt: "2026-06-11T00:00:00.000Z",
    revision: { weekday: "test-weekday", holiday: "test-holiday" },
    stations: {
      橋本: {
        上り方面: {
          weekday: [
            { time: "10:05", kind: "各駅停車", dest: "新宿", trainNo: "UP-SCHEDULE", isDeparture: true },
          ],
          holiday: [],
        },
        下り方面: {
          weekday: [
            { time: "10:26", kind: "急行", dest: "重複候補", trainNo: "DOWN-DUP", isDeparture: true },
            { time: "10:30", kind: "各駅停車", dest: "橋本", trainNo: "DOWN-SCHEDULE", isDeparture: true },
          ],
          holiday: [],
        },
      },
    },
  },
}));

import {
  __resetCachesForTest,
  collectUpcomingTrains,
  currentServiceDayMinutes,
  destinationLabel,
  directionKey,
  distanceBeforeBoarding,
  fetchDepartures,
  formatMinutes,
  groupDepartures,
  isProbablyUnreachableBranch,
  parseDelay,
  parsePositionOrder,
  parseServiceDayTimeToMinutes,
  serviceDateKey,
  serviceLabel,
  stationBranch,
} from "../departures.js";

beforeEach(() => {
  __resetCachesForTest();
});

afterEach(() => {
  __resetCachesForTest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("serviceLabel", () => {
  it.each([
    ["1", "特急"],
    ["2", "急行"],
    ["3", "快速"],
    ["4", "準特急"],
    ["5", "区間急行"],
    ["6", "各駅停車"],
    ["7", "回送"],
    ["9", "京王ライナー"],
    ["10", "臨時"],
    ["11", "Mt.TAKAO号"],
  ])("既知コード %s を表示名へ変換する", (code, expected) => {
    expect(serviceLabel(code)).toBe(expected);
  });

  it("未知コードと未設定値に既定表示を使う", () => {
    expect(serviceLabel("99")).toBe("種別99");
    expect(serviceLabel(undefined)).toBe("不明");
  });
});

describe("destinationLabel", () => {
  it.each([
    ["001", "新宿"],
    ["027", "高幡不動"],
    ["032", "京王八王子"],
    ["036", "高幡不動"],
    ["037", "北野"],
    ["043", "高尾山口"],
    ["048", "橋本"],
    ["054", "橋本"],
    ["081", "渋谷"],
    ["097", "吉祥寺"],
    ["120", "本八幡"],
    ["301", "新線新宿"],
  ])("既知コード %s を表示名へ変換する", (code, expected) => {
    expect(destinationLabel(code)).toBe(expected);
  });

  it("未知コードと未設定値に既定表示を使う", () => {
    expect(destinationLabel("999")).toBe("行先999");
    expect(destinationLabel(undefined)).toBe("不明");
  });
});

describe("directionKey", () => {
  it("上下方向を反転させず表示キーへ変換し、不明方向では行先を使う", () => {
    expect(directionKey("0", "橋本")).toBe("上り方面");
    expect(directionKey("1", "新宿")).toBe("下り方面");
    expect(directionKey("x", "橋本")).toBe("橋本方面");
    expect(directionKey(undefined, "")).toBe("方面未設定");
  });
});

describe("distanceBeforeBoarding", () => {
  it("下りは小さい駅番号、上りは大きい駅番号を乗車駅より手前として扱う", () => {
    expect(distanceBeforeBoarding(14, 16, "1")).toBe(2);
    expect(distanceBeforeBoarding(16, 16, "1")).toBe(0);
    expect(distanceBeforeBoarding(17, 16, "1")).toBeUndefined();
    expect(distanceBeforeBoarding(18, 16, "0")).toBe(2);
    expect(distanceBeforeBoarding(16, 16, "0")).toBe(0);
    expect(distanceBeforeBoarding(15, 16, "0")).toBeUndefined();
    expect(distanceBeforeBoarding(16, 16, undefined)).toBeUndefined();
  });
});

describe("分岐線判定", () => {
  it.each([
    ["調布", "common"],
    ["橋本", "sagamihara"],
    ["京王八王子", "hachiojiTakao"],
  ] as const)("%s の所属線を判定する", (station, expected) => {
    expect(stationBranch(station)).toBe(expected);
  });

  it("共通区間では行先にかかわらず除外しない", () => {
    expect(isProbablyUnreachableBranch("調布", { ik: "032", ik_tr: "048" })).toBe(false);
  });

  it("相模原線では八王子・高尾線専用行先だけを除外する", () => {
    expect(isProbablyUnreachableBranch("橋本", { ik: "032" })).toBe(true);
    expect(isProbablyUnreachableBranch("橋本", { ik: "032", ik_tr: "048" })).toBe(false);
  });

  it("八王子・高尾線では相模原線専用行先だけを除外する", () => {
    expect(isProbablyUnreachableBranch("京王八王子", { ik: "048" })).toBe(true);
    expect(isProbablyUnreachableBranch("京王八王子", { ik: "032" })).toBe(false);
  });
});

describe("運行日時刻", () => {
  it("03:59 は前運行日の翌日分、04:00 は当日分として解釈する", () => {
    expect(parseServiceDayTimeToMinutes("03:59")).toBe(27 * 60 + 59);
    expect(parseServiceDayTimeToMinutes("04:00")).toBe(4 * 60);
  });

  it("現在時刻も 04:00 境界で運行日分へ変換する", () => {
    expect(currentServiceDayMinutes(new Date(2026, 5, 11, 3, 59))).toBe(27 * 60 + 59);
    expect(currentServiceDayMinutes(new Date(2026, 5, 11, 4, 0))).toBe(4 * 60);
  });

  it("03:59 は前日、04:00 は当日の運行日キーを返す", () => {
    expect(serviceDateKey(new Date(2026, 5, 1, 3, 59))).toBe("2026-05-31");
    expect(serviceDateKey(new Date(2026, 5, 1, 4, 0))).toBe("2026-06-01");
  });

  it("分を 24 時間でラップし、負値も正規化する", () => {
    expect(formatMinutes(24 * 60)).toBe("00:00");
    expect(formatMinutes(27 * 60 + 5)).toBe("03:05");
    expect(formatMinutes(-1)).toBe("23:59");
  });
});

describe("入力値パーサー", () => {
  it("遅延は空・NaN・負値を 0 にし、正常値を数値化する", () => {
    expect(parseDelay(undefined)).toBe(0);
    expect(parseDelay("")).toBe(0);
    expect(parseDelay("invalid")).toBe(0);
    expect(parseDelay("-3")).toBe(0);
    expect(parseDelay("5")).toBe(5);
  });

  it("駅位置 ID の3桁部分だけを数値化する", () => {
    expect(parsePositionOrder("K001")).toBe(1);
    expect(parsePositionOrder("S054")).toBe(54);
    expect(parsePositionOrder("K01")).toBeUndefined();
    expect(parsePositionOrder("001")).toBeUndefined();
    expect(parsePositionOrder(undefined)).toBeUndefined();
  });
});

describe("groupDepartures", () => {
  it("方向と時刻でソートして表示件数を制限し、source と遅延情報を整形する", () => {
    const result = groupDepartures(
      [
        {
          trainId: "UP-LATE",
          direction: "上り方面",
          kind: "急行",
          dest: "新宿",
          scheduledMinutes: 10 * 60,
          estimatedMinutes: 10 * 60 + 5,
          delay: 5,
          source: "realtime",
        },
        {
          trainId: "UP-ON-TIME",
          direction: "上り方面",
          kind: "各駅停車",
          dest: "新宿",
          scheduledMinutes: 9 * 60 + 55,
          estimatedMinutes: 9 * 60 + 55,
          delay: 0,
          source: "realtime",
        },
        {
          trainId: "UP-OUTSIDE-LIMIT",
          direction: "上り方面",
          kind: "特急",
          dest: "新宿",
          scheduledMinutes: 10 * 60 + 10,
          estimatedMinutes: 10 * 60 + 10,
          delay: 0,
          source: "realtime",
        },
        {
          trainId: "DOWN-SCHEDULE",
          direction: "下り方面",
          kind: "各駅停車",
          dest: "橋本",
          scheduledMinutes: 10 * 60 + 2,
          estimatedMinutes: 10 * 60 + 2,
          delay: 0,
          source: "schedule",
        },
      ],
      2,
    );

    expect(Object.keys(result)).toEqual(["下り方面", "上り方面"]);
    expect(result["上り方面"]).toEqual([
      {
        time: "09:55",
        scheduled: undefined,
        kind: "各駅停車",
        dest: "新宿",
        delay: 0,
        source: "realtime",
      },
      {
        time: "10:05",
        scheduled: "10:00",
        kind: "急行",
        dest: "新宿",
        delay: 5,
        source: "realtime",
      },
    ]);
    expect(result["下り方面"]).toEqual([
      {
        time: "10:02",
        scheduled: undefined,
        kind: "各駅停車",
        dest: "橋本",
        delay: undefined,
        source: "schedule",
      },
    ]);
  });
});

describe("collectUpcomingTrains", () => {
  it("K/S 線だけを方向別の駅距離順に集め、到達済み列車と不正位置を除外する", () => {
    const result = collectUpcomingTrains(
      {
        TS: [
          { id: "K015", sn: "K", ps: [{ tr: " DOWN-NEAR ", ki: "1", ik: "032" }] },
          { id: "K014", sn: "K", ps: [{ tr: "DOWN-FAR", ki: "1", ik: "032" }] },
          { id: "K017", sn: "K", ps: [{ tr: "DOWN-PASSED", ki: "1", ik: "032" }] },
          { id: "K018", sn: "K", ps: [{ tr: "UPCOMING-UP", ki: "0", ik: "001" }] },
          { id: "invalid", sn: "K", ps: [{ tr: "INVALID-POSITION", ki: "1", ik: "032" }] },
          { id: "K016", sn: "X", ps: [{ tr: "OTHER-LINE", ki: "1", ik: "032" }] },
        ],
        TB: [{ id: "S016", sn: "S", ps: [{ tr: "DOWN-HERE", ki: "1", ik: "048" }] }],
      },
      "調布",
      16,
    );

    expect(result.map(({ trainId, distanceToStation }) => [trainId, distanceToStation])).toEqual([
      ["DOWN-HERE", 0],
      ["DOWN-NEAR", 1],
      ["DOWN-FAR", 2],
      ["UPCOMING-UP", 2],
    ]);
  });

  it("乗車駅から到達不能と推定できる分岐線の列車を除外する", () => {
    const result = collectUpcomingTrains(
      {
        TS: [
          {
            id: "K054",
            sn: "K",
            ps: [
              { tr: "HACHIOJI", ki: "1", ik: "032" },
              { tr: "SAGAMIHARA", ki: "1", ik: "048" },
            ],
          },
        ],
      },
      "橋本",
      54,
    );

    expect(result.map(({ trainId }) => trainId)).toEqual(["SAGAMIHARA"]);
  });
});

describe("fetchDepartures", () => {
  it("不足方向だけを時刻表補完し、trainNo 重複を除外して source を保持する", async () => {
    const traffic = {
      TS: [
        {
          id: "K054",
          sn: "K",
          ps: [
            { tr: "UP-1", ki: "0", sy: "1", ik: "048" },
            { tr: "UP-2", ki: "0", sy: "2", ik: "048" },
            { tr: "DOWN-DUP", ki: "1", sy: "6", ik: "048", dl: "2" },
          ],
        },
      ],
    };
    const diaByTrainId: Record<string, unknown> = {
      "UP-1": { dy: [{ sn: "橋本", ht: "10:10" }] },
      "UP-2": { dy: [{ sn: "橋本", ht: "10:20" }] },
      "DOWN-DUP": { dy: [{ sn: "橋本", ht: "10:23" }] },
    };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/traffic_info.json")) {
        return Response.json(traffic);
      }
      const trainId = decodeURIComponent(url.split("/").at(-1)?.replace(/\.json$/, "") ?? "");
      const dia = diaByTrainId[trainId];
      if (dia) {
        return Response.json(dia);
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchDepartures({
      boardingStation: "橋本",
      displayCount: 2,
      now: new Date(2026, 5, 11, 10, 0),
    });

    expect(result.departures["上り方面"]).toEqual([
      expect.objectContaining({ time: "10:10", source: "realtime" }),
      expect.objectContaining({ time: "10:20", source: "realtime" }),
    ]);
    expect(result.departures["上り方面"].some(({ source }) => source === "schedule")).toBe(false);
    expect(result.departures["下り方面"]).toEqual([
      {
        time: "10:25",
        scheduled: "10:23",
        kind: "各駅停車",
        dest: "橋本",
        delay: 2,
        source: "realtime",
      },
      {
        time: "10:30",
        scheduled: undefined,
        kind: "各駅停車",
        dest: "橋本",
        delay: undefined,
        source: "schedule",
      },
    ]);
    expect(result.departures["下り方面"].some(({ dest }) => dest === "重複候補")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
