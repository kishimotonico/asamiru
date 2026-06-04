import { describe, expect, it } from "vitest";
import {
  selectDesiredSleeping,
  sleepIntentReducer,
  type SleepIntentState,
} from "./useSleepIntent";
import type { SleepSettings } from "./sleepSettingsAtom";

const AWAKE_MS = 15 * 60_000;

// 月曜 06:00-09:00 の起床窓。2026-06-01 は月曜
const settings: SleepSettings = {
  enabled: true,
  windows: [{ id: "w", days: [1], start: "06:00", end: "09:00" }],
  manualWakeDurationMin: 15,
};

const monday0700 = new Date(2026, 5, 1, 7, 0).getTime(); // 起床帯の中
const monday1200 = new Date(2026, 5, 1, 12, 0).getTime(); // スリープ帯

function scheduleState(now = 1_000_000): SleepIntentState {
  return { now, intent: { mode: "schedule" } };
}
function tempAwakeState(until: number, now = until - 1): SleepIntentState {
  return { now, intent: { mode: "tempAwake", until } };
}
function forcedSleepState(releaseAt: number | null, now = 1_000_000): SleepIntentState {
  return { now, intent: { mode: "forcedSleep", releaseAt } };
}

// --- reducer ---

describe("sleepIntentReducer: tick", () => {
  it("schedule は now を更新するだけ（intent 不変）", () => {
    const s = scheduleState(1000);
    const next = sleepIntentReducer(s, { type: "tick", now: 2000 });
    expect(next.now).toBe(2000);
    expect(next.intent.mode).toBe("schedule");
  });

  it("tempAwake の now < until では schedule へ変化しない", () => {
    const s = tempAwakeState(5000, 3000);
    const next = sleepIntentReducer(s, { type: "tick", now: 4000 });
    expect(next.intent.mode).toBe("tempAwake");
  });

  it("tempAwake の now >= until で schedule へ正規化する", () => {
    const s = tempAwakeState(5000, 4000);
    const next = sleepIntentReducer(s, { type: "tick", now: 5000 });
    expect(next.intent.mode).toBe("schedule");
    expect(next.now).toBe(5000);
  });

  it("forcedSleep で releaseAt=null なら tick で解除されない", () => {
    const s = forcedSleepState(null, 1000);
    const next = sleepIntentReducer(s, { type: "tick", now: 9_999_999 });
    expect(next.intent.mode).toBe("forcedSleep");
  });

  it("forcedSleep で now < releaseAt なら解除されない", () => {
    const s = forcedSleepState(5000, 3000);
    const next = sleepIntentReducer(s, { type: "tick", now: 4999 });
    expect(next.intent.mode).toBe("forcedSleep");
  });

  it("forcedSleep で now >= releaseAt なら schedule へ正規化する", () => {
    const s = forcedSleepState(5000, 3000);
    const next = sleepIntentReducer(s, { type: "tick", now: 5000 });
    expect(next.intent.mode).toBe("schedule");
    expect(next.now).toBe(5000);
  });
});

describe("sleepIntentReducer: activity", () => {
  it("schedule から tempAwake へ遷移する", () => {
    const s = scheduleState(1000);
    const next = sleepIntentReducer(s, { type: "activity", now: 2000, awakeMs: AWAKE_MS });
    expect(next.intent.mode).toBe("tempAwake");
    if (next.intent.mode === "tempAwake") {
      expect(next.intent.until).toBe(2000 + AWAKE_MS);
    }
    expect(next.now).toBe(2000);
  });

  it("tempAwake から tempAwake へ（until を更新）", () => {
    const s = tempAwakeState(3000, 2000);
    const next = sleepIntentReducer(s, { type: "activity", now: 2500, awakeMs: AWAKE_MS });
    expect(next.intent.mode).toBe("tempAwake");
    if (next.intent.mode === "tempAwake") {
      expect(next.intent.until).toBe(2500 + AWAKE_MS);
    }
  });

  it("forcedSleep から tempAwake へ遷移する（強制解除）", () => {
    const s = forcedSleepState(9_999_999, 1000);
    const next = sleepIntentReducer(s, { type: "activity", now: 2000, awakeMs: AWAKE_MS });
    expect(next.intent.mode).toBe("tempAwake");
    if (next.intent.mode === "tempAwake") {
      expect(next.intent.until).toBe(2000 + AWAKE_MS);
    }
  });
});

describe("sleepIntentReducer: forceSleep", () => {
  it("schedule から forcedSleep へ遷移する（releaseAt あり）", () => {
    const s = scheduleState(1000);
    const next = sleepIntentReducer(s, { type: "forceSleep", now: 2000, releaseAt: 5000 });
    expect(next.intent.mode).toBe("forcedSleep");
    if (next.intent.mode === "forcedSleep") {
      expect(next.intent.releaseAt).toBe(5000);
    }
    expect(next.now).toBe(2000);
  });

  it("tempAwake から forcedSleep へ遷移する", () => {
    const s = tempAwakeState(9_999_999, 1000);
    const next = sleepIntentReducer(s, { type: "forceSleep", now: 1500, releaseAt: null });
    expect(next.intent.mode).toBe("forcedSleep");
    if (next.intent.mode === "forcedSleep") {
      expect(next.intent.releaseAt).toBeNull();
    }
  });

  it("forcedSleep から forcedSleep へ（releaseAt を更新）", () => {
    const s = forcedSleepState(5000, 1000);
    const next = sleepIntentReducer(s, { type: "forceSleep", now: 2000, releaseAt: 8000 });
    expect(next.intent.mode).toBe("forcedSleep");
    if (next.intent.mode === "forcedSleep") {
      expect(next.intent.releaseAt).toBe(8000);
    }
  });
});

describe("sleepIntentReducer: resync", () => {
  it("schedule は resync で変化しない（同一参照）", () => {
    const s = scheduleState(1000);
    const next = sleepIntentReducer(s, { type: "resync", now: 2000, awakeMs: AWAKE_MS, releaseAt: null });
    expect(next).toBe(s); // 同一参照
  });

  it("tempAwake 中は until を新しい awakeMs で取り直す", () => {
    const s = tempAwakeState(5000, 1000);
    const next = sleepIntentReducer(s, { type: "resync", now: 2000, awakeMs: AWAKE_MS, releaseAt: null });
    expect(next.intent.mode).toBe("tempAwake");
    if (next.intent.mode === "tempAwake") {
      expect(next.intent.until).toBe(2000 + AWAKE_MS);
    }
    expect(next.now).toBe(2000);
  });

  it("forcedSleep 中は releaseAt を取り直す", () => {
    const s = forcedSleepState(5000, 1000);
    const next = sleepIntentReducer(s, { type: "resync", now: 2000, awakeMs: AWAKE_MS, releaseAt: 9000 });
    expect(next.intent.mode).toBe("forcedSleep");
    if (next.intent.mode === "forcedSleep") {
      expect(next.intent.releaseAt).toBe(9000);
    }
    expect(next.now).toBe(2000);
  });

  it("tempAwake 中はスケジュール内外を問わず反映する（旧挙動からの変更点）", () => {
    // 起床帯（月曜07:00）の中でも tempAwake なら duration 変更を反映する
    const s = tempAwakeState(monday0700 + 5000, monday0700);
    const next = sleepIntentReducer(s, {
      type: "resync",
      now: monday0700 + 1000,
      awakeMs: AWAKE_MS * 2,
      releaseAt: null,
    });
    expect(next.intent.mode).toBe("tempAwake");
    if (next.intent.mode === "tempAwake") {
      expect(next.intent.until).toBe(monday0700 + 1000 + AWAKE_MS * 2);
    }
  });
});

// --- selector ---

describe("selectDesiredSleeping: schedule モード", () => {
  it("起床帯の中ではスリープしない", () => {
    expect(selectDesiredSleeping(scheduleState(monday0700), settings)).toBe(false);
  });

  it("起床帯の外ではスリープする", () => {
    expect(selectDesiredSleeping(scheduleState(monday1200), settings)).toBe(true);
  });

  it("有効な窓が無ければスリープしない", () => {
    const noWindow: SleepSettings = { ...settings, windows: [] };
    expect(selectDesiredSleeping(scheduleState(monday1200), noWindow)).toBe(false);
  });
});

describe("selectDesiredSleeping: tempAwake モード", () => {
  it("until 未到達なら起床帯外でもスリープしない", () => {
    const s = tempAwakeState(monday1200 + AWAKE_MS, monday1200);
    expect(selectDesiredSleeping(s, settings)).toBe(false);
  });

  it("until 到達後はスケジュール評価に戻る（スリープ帯ならスリープ）", () => {
    const s: SleepIntentState = { now: monday1200 + AWAKE_MS, intent: { mode: "tempAwake", until: monday1200 + AWAKE_MS } };
    expect(selectDesiredSleeping(s, settings)).toBe(true);
  });

  it("until 到達後はスケジュール評価に戻る（起床帯ならスリープしない）", () => {
    const s: SleepIntentState = { now: monday0700 + AWAKE_MS, intent: { mode: "tempAwake", until: monday0700 } };
    expect(selectDesiredSleeping(s, settings)).toBe(false);
  });
});

describe("selectDesiredSleeping: forcedSleep モード", () => {
  it("releaseAt=null なら常にスリープ（起床帯でも）", () => {
    const s = forcedSleepState(null, monday0700);
    expect(selectDesiredSleeping(s, settings)).toBe(true);
  });

  it("releaseAt 未到達なら常にスリープ（起床帯でも）", () => {
    const s = forcedSleepState(monday0700 + 10_000, monday0700);
    expect(selectDesiredSleeping(s, settings)).toBe(true);
  });

  it("releaseAt 到達後はスケジュール評価（スリープ帯ならスリープ）", () => {
    const s: SleepIntentState = {
      now: monday1200,
      intent: { mode: "forcedSleep", releaseAt: monday1200 },
    };
    expect(selectDesiredSleeping(s, settings)).toBe(true);
  });

  it("releaseAt 到達後はスケジュール評価（起床帯ならスリープしない）", () => {
    const s: SleepIntentState = {
      now: monday0700,
      intent: { mode: "forcedSleep", releaseAt: monday0700 },
    };
    expect(selectDesiredSleeping(s, settings)).toBe(false);
  });
});
