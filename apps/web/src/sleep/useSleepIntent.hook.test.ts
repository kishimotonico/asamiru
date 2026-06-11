// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TICK_INTERVAL_MS, useSleepIntent } from "./useSleepIntent";
import { nextScheduleWakeStartAfter } from "./sleepSettingsAtom";
import type { SleepSettings } from "./sleepSettingsAtom";

// 月曜 06:00-09:00 の起床窓。2026-06-01 は月曜
const baseSettings: SleepSettings = {
  enabled: true,
  windows: [{ id: "w", days: [1], start: "06:00", end: "09:00" }],
  manualWakeDurationMin: 15,
};

const monday0700 = new Date(2026, 5, 1, 7, 0).getTime(); // 起床帯の中
const monday1200 = new Date(2026, 5, 1, 12, 0).getTime(); // スリープ帯（月曜12:00）

/** TICK_INTERVAL_MS 刻みで ms 進める（tick 1回ずつ確実に発火させる） */
async function advanceByTicks(ms: number) {
  let remaining = ms;
  while (remaining > 0) {
    const step = Math.min(TICK_INTERVAL_MS, remaining);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
    remaining -= step;
  }
}

describe("useSleepIntent (hook)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tick タイマーで tempAwake が失効し schedule（スリープ帯ならスリープ）へ復帰する", () => {
    vi.setSystemTime(monday1200);

    const { result } = renderHook(() => useSleepIntent(baseSettings));

    // スリープ帯では初期状態 schedule で desiredSleeping=true
    expect(result.current.desiredSleeping).toBe(true);

    // 操作で一時起床へ
    act(() => {
      result.current.actions.activity();
    });
    expect(result.current.desiredSleeping).toBe(false);

    // until (= activity 時刻 + 15分) の手前まで進めても起床のまま
    return advanceByTicks(15 * 60_000 - TICK_INTERVAL_MS).then(() => {
      expect(result.current.desiredSleeping).toBe(false);

      // until を超える tick で schedule へ正規化 → スリープ帯なので desiredSleeping=true
      return advanceByTicks(TICK_INTERVAL_MS * 2).then(() => {
        expect(result.current.desiredSleeping).toBe(true);
      });
    });
  });

  it("forcedSleep の releaseAt に tick で到達すると自動解除され schedule 評価に戻る", async () => {
    vi.setSystemTime(monday1200);

    const { result } = renderHook(() => useSleepIntent(baseSettings));

    act(() => {
      result.current.actions.forceSleep();
    });
    expect(result.current.desiredSleeping).toBe(true);

    // releaseAt = 次の起床帯開始（翌月曜06:00）
    const releaseAt = nextScheduleWakeStartAfter(new Date(monday1200), baseSettings.windows);
    expect(releaseAt).not.toBeNull();
    const untilRelease = (releaseAt as number) - monday1200;

    // releaseAt 直前まで進めてもスリープのまま
    await advanceByTicks(untilRelease - TICK_INTERVAL_MS);
    expect(result.current.desiredSleeping).toBe(true);

    // releaseAt 到達で schedule へ正規化 → 起床帯（06:00-09:00）の中なので desiredSleeping=false
    await advanceByTicks(TICK_INTERVAL_MS * 2);
    expect(result.current.desiredSleeping).toBe(false);
  });

  it("forcedSleep(releaseAt=null) は tick が進んでも自動解除されない", async () => {
    // 起床窓を無効化（releaseAt は null になる）
    vi.setSystemTime(monday1200);
    const noWindowSettings: SleepSettings = { ...baseSettings, windows: [] };

    const { result } = renderHook(() => useSleepIntent(noWindowSettings));

    act(() => {
      result.current.actions.forceSleep();
    });
    expect(result.current.desiredSleeping).toBe(true);

    // 数時間分 tick を進めても解除されない
    await advanceByTicks(6 * 60 * 60_000);
    expect(result.current.desiredSleeping).toBe(true);
  });

  it("tempAwake 中に設定変更（manualWakeDurationMin 延長）すると until が resync で取り直される", async () => {
    vi.setSystemTime(monday1200);

    const { result, rerender } = renderHook(({ settings }) => useSleepIntent(settings), {
      initialProps: { settings: baseSettings },
    });

    act(() => {
      result.current.actions.activity();
    });
    expect(result.current.desiredSleeping).toBe(false);

    // manualWakeDurationMin を 15分→30分へ変更（resync で until = now + 30分 に取り直される）
    const extendedSettings: SleepSettings = { ...baseSettings, manualWakeDurationMin: 30 };
    act(() => {
      rerender({ settings: extendedSettings });
    });

    // 旧 until（+15分）を超えても、新 until（+30分）未到達なら起床のまま
    await advanceByTicks(20 * 60_000);
    expect(result.current.desiredSleeping).toBe(false);

    // 新 until（+30分）を超えたら schedule 評価（スリープ帯なので desiredSleeping=true）
    await advanceByTicks(15 * 60_000);
    expect(result.current.desiredSleeping).toBe(true);
  });

  it("forcedSleep 中に設定変更すると releaseAt が resync で取り直される", async () => {
    vi.setSystemTime(monday0700);

    const { result, rerender } = renderHook(({ settings }) => useSleepIntent(settings), {
      initialProps: { settings: baseSettings },
    });

    // 起床帯のど真ん中で forceSleep → releaseAt は「次の」起床帯開始（翌月曜06:00）
    act(() => {
      result.current.actions.forceSleep();
    });
    expect(result.current.desiredSleeping).toBe(true);

    // 起床窓を削除（スケジュール無効相当）すると releaseAt は resync で null へ取り直される
    const noWindowSettings: SleepSettings = { ...baseSettings, windows: [] };
    act(() => {
      rerender({ settings: noWindowSettings });
    });

    // releaseAt=null になったため、当初の releaseAt（翌週月曜06:00）を超えても解除されない
    const originalReleaseAt = nextScheduleWakeStartAfter(new Date(monday0700), baseSettings.windows) as number;
    await advanceByTicks(originalReleaseAt - monday0700 + TICK_INTERVAL_MS * 2);
    expect(result.current.desiredSleeping).toBe(true);
  });

  it("schedule モード中に設定変更しても無変化（resync は no-op）", () => {
    vi.setSystemTime(monday0700);

    const { result, rerender } = renderHook(({ settings }) => useSleepIntent(settings), {
      initialProps: { settings: baseSettings },
    });

    // 起床帯の中: schedule のまま desiredSleeping=false
    expect(result.current.desiredSleeping).toBe(false);

    const changedSettings: SleepSettings = { ...baseSettings, manualWakeDurationMin: 60 };
    act(() => {
      rerender({ settings: changedSettings });
    });

    // schedule のままなので評価は変わらない
    expect(result.current.desiredSleeping).toBe(false);
  });
});
