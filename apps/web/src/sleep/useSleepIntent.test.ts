import { describe, expect, it } from "vitest";
import {
  selectDesiredSleeping,
  sleepIntentReducer,
  type SleepIntentState,
} from "./useSleepIntent";
import type { SleepSettings } from "./sleepSettingsAtom";

const AWAKE_MS = 15 * 60_000;

function state(partial: Partial<SleepIntentState> = {}): SleepIntentState {
  return { now: 1_000_000, awakeUntil: 0, manualSleeping: false, ...partial };
}

describe("sleepIntentReducer", () => {
  it("tick は now だけ更新する", () => {
    const next = sleepIntentReducer(state({ awakeUntil: 5, manualSleeping: true }), { type: "tick", now: 42 });
    expect(next).toEqual({ now: 42, awakeUntil: 5, manualSleeping: true });
  });

  it("manualSleep は manualSleeping を立て now を進める", () => {
    const next = sleepIntentReducer(state(), { type: "manualSleep", now: 200 });
    expect(next.manualSleeping).toBe(true);
    expect(next.now).toBe(200);
  });

  it("wake は manual を解除し awakeUntil をセットする", () => {
    const next = sleepIntentReducer(state({ manualSleeping: true }), { type: "wake", now: 1000, awakeMs: AWAKE_MS });
    expect(next.manualSleeping).toBe(false);
    expect(next.awakeUntil).toBe(1000 + AWAKE_MS);
    expect(next.now).toBe(1000);
  });

  it("extend は manual を変えず awakeUntil を延長する", () => {
    const next = sleepIntentReducer(state({ manualSleeping: true }), { type: "extend", now: 2000, awakeMs: AWAKE_MS });
    expect(next.manualSleeping).toBe(true);
    expect(next.awakeUntil).toBe(2000 + AWAKE_MS);
  });

  it("clearManual は manualSleeping を解除する（既に false なら同一参照）", () => {
    const off = state({ manualSleeping: false });
    expect(sleepIntentReducer(off, { type: "clearManual" })).toBe(off);
    const on = state({ manualSleeping: true });
    expect(sleepIntentReducer(on, { type: "clearManual" }).manualSleeping).toBe(false);
  });

  it("resyncAwake は一時起床中のときだけ期限を取り直す", () => {
    const sleeping = state({ awakeUntil: 0, now: 500 });
    expect(sleepIntentReducer(sleeping, { type: "resyncAwake", now: 500, awakeMs: AWAKE_MS })).toBe(sleeping);

    const awake = state({ awakeUntil: 10_000, now: 500 });
    const next = sleepIntentReducer(awake, { type: "resyncAwake", now: 600, awakeMs: AWAKE_MS });
    expect(next.awakeUntil).toBe(600 + AWAKE_MS);
  });
});

describe("selectDesiredSleeping", () => {
  // 平日の朝だけ起床する設定。月曜 06:00-09:00。
  const settings: SleepSettings = {
    enabled: true,
    windows: [{ id: "w", days: [1], start: "06:00", end: "09:00" }],
    manualWakeDurationMin: 15,
  };
  const monday0700 = new Date(2026, 5, 1, 7, 0).getTime(); // 2026-06-01 は月曜
  const monday1200 = new Date(2026, 5, 1, 12, 0).getTime();

  it("起床帯の中ではスリープしない", () => {
    expect(selectDesiredSleeping(state({ now: monday0700 }), settings)).toBe(false);
  });

  it("起床帯の外ではスリープする", () => {
    expect(selectDesiredSleeping(state({ now: monday1200 }), settings)).toBe(true);
  });

  it("一時起床中はスリープ帯でもスリープしない", () => {
    expect(
      selectDesiredSleeping(state({ now: monday1200, awakeUntil: monday1200 + AWAKE_MS }), settings),
    ).toBe(false);
  });

  it("手動スリープは起床帯でもスリープする", () => {
    expect(selectDesiredSleeping(state({ now: monday0700, manualSleeping: true }), settings)).toBe(true);
  });

  it("有効な起床帯が無ければ自動スリープしない", () => {
    const noWindow: SleepSettings = { ...settings, windows: [] };
    expect(selectDesiredSleeping(state({ now: monday1200 }), noWindow)).toBe(false);
  });
});
