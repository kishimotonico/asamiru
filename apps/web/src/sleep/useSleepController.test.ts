// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSleepController } from "./useSleepController";
import { TICK_INTERVAL_MS } from "./useSleepIntent";
import type { SleepSettings } from "./sleepSettingsAtom";
import type { DisplayInfoResponse } from "@asamiru/shared";

const SETTINGS_KEY = "asamiru-sleep-settings";

// 月曜 06:00-09:00 の起床窓。2026-06-01 は月曜
const settings: SleepSettings = {
  enabled: true,
  windows: [{ id: "w", days: [1], start: "06:00", end: "09:00" }],
  manualWakeDurationMin: 15,
};

const monday0700 = new Date(2026, 5, 1, 7, 0).getTime(); // 起床帯の中
const monday0850 = new Date(2026, 5, 1, 8, 50).getTime(); // 起床帯の終わり間際
const monday1200 = new Date(2026, 5, 1, 12, 0).getTime(); // スリープ帯

/** モニター連動を無効化する fetch モック（GET /api/system/display → {enabled:false}） */
function stubDisplayFetchDisabled() {
  const disabled: DisplayInfoResponse = { enabled: false };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => disabled,
    })),
  );
}

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

function dispatchKeydown(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

function dispatchPointerdown() {
  act(() => {
    window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  });
}

describe("useSleepController (composition)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    stubDisplayFetchDisabled();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("モニター連動が無効（{enabled:false}）の場合、sleeping は desiredSleeping のみで決まる", () => {
    vi.setSystemTime(monday1200); // スリープ帯

    const { result } = renderHook(() => useSleepController());

    // schedule モード・スリープ帯なので sleeping=true（display.enabled=false で OR 項は効かない）
    expect(result.current.sleeping).toBe(true);
  });

  it("起きている間の keydown/pointerdown は activity となり tempAwake を延長する", async () => {
    // 起床帯終わり間際（08:50）。tempAwake への activity が無ければ 09:00 でスリープへ
    vi.setSystemTime(monday0850);

    const { result } = renderHook(() => useSleepController());
    expect(result.current.sleeping).toBe(false);

    // pointerdown で activity → tempAwake.until = 08:50 + 15分 = 09:05
    dispatchPointerdown();
    expect(result.current.sleeping).toBe(false);

    // 09:00 を過ぎても tempAwake が有効なので起きたまま
    await advanceByTicks(11 * 60_000); // 09:01 相当
    expect(result.current.sleeping).toBe(false);

    // tempAwake の until（09:05）を過ぎると schedule 評価に戻り、起床帯外なのでスリープ
    await advanceByTicks(6 * 60_000); // 09:07 相当
    expect(result.current.sleeping).toBe(true);
  });

  it("'s' キーで forceSleep が発火し、即座にスリープ表示になる", () => {
    // 起床帯の中（07:00）。schedule 的には起きているはず
    vi.setSystemTime(monday0700);

    const { result } = renderHook(() => useSleepController());
    expect(result.current.sleeping).toBe(false);

    dispatchKeydown("s");

    expect(result.current.sleeping).toBe(true);
  });

  it("スリープ中の入力で即座に復帰する", () => {
    vi.setSystemTime(monday1200); // スリープ帯

    const { result } = renderHook(() => useSleepController());
    expect(result.current.sleeping).toBe(true);

    dispatchKeydown("Enter");

    expect(result.current.sleeping).toBe(false);
  });

  it("復帰直後300msの入力は誤操作として抑止され、tempAwake は延長されない", async () => {
    vi.setSystemTime(monday1200); // スリープ帯

    const { result } = renderHook(() => useSleepController());
    expect(result.current.sleeping).toBe(true);

    // 復帰（activity, until = now + 15分）
    dispatchKeydown("Enter");
    expect(result.current.sleeping).toBe(false);

    // 100ms 後（300ms 抑止期間内）に再度入力 → onActivity は呼ばれず until は延長されない
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    dispatchKeydown("Enter");
    expect(result.current.sleeping).toBe(false);

    // 最初の until（復帰時刻 + 15分）を過ぎると、抑止された2回目の入力は無視されているため
    // tempAwake が失効し schedule 評価（スリープ帯）へ戻る
    await advanceByTicks(15 * 60_000 - 100 + TICK_INTERVAL_MS);
    expect(result.current.sleeping).toBe(true);
  });

  it("抑止期間後の入力は activity として扱われ tempAwake を延長する", async () => {
    vi.setSystemTime(monday1200); // スリープ帯

    const { result } = renderHook(() => useSleepController());
    expect(result.current.sleeping).toBe(true);

    // 復帰（activity, until = now + 15分）
    dispatchKeydown("Enter");
    expect(result.current.sleeping).toBe(false);

    // 抑止期間（300ms）が過ぎてから再度入力 → activity として扱われ until が延長される
    // （1回目: until1 = 0 + 15分 = 900_000ms、2回目: until2 = 400 + 15分 = 900_400ms）
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    dispatchKeydown("Enter");
    expect(result.current.sleeping).toBe(false);

    // until1（900_000ms 経過時点）を過ぎても、2回目の activity による until2（900_400ms）が
    // 有効なため、まだ起きている
    await advanceByTicks(15 * 60_000 - 400);
    expect(result.current.sleeping).toBe(false);

    // until2 を過ぎると tempAwake が失効し schedule 評価（スリープ帯）へ戻る
    await advanceByTicks(TICK_INTERVAL_MS);
    expect(result.current.sleeping).toBe(true);
  });
});
