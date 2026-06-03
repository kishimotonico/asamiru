import { useEffect, useMemo, useReducer } from "react";
import { scheduleAwakeNow, scheduleSleepingNow, type SleepSettings } from "./sleepSettingsAtom";

export const TICK_INTERVAL_MS = 15_000;

/**
 * アプリの「スリープ意図」を司る状態。物理モニターの状態は持たない
 * （責務分離: モニター連動は useDisplaySync、入力は useGlobalInput）。
 *
 * - now: 境界・期限の再評価に使う現在時刻
 * - awakeUntil: ユーザー操作による一時起床の期限（ms epoch）
 * - manualSleeping: 手動スリープ中か（起床帯でもスリープを維持する）
 */
export type SleepIntentState = {
  now: number;
  awakeUntil: number;
  manualSleeping: boolean;
};

export type SleepIntentAction =
  | { type: "tick"; now: number }
  /** 手動スリープ（s キー / スリープボタン / 物理OFF）。起床帯でもスリープを維持 */
  | { type: "manualSleep"; now: number }
  /** スリープからの復帰（操作 / 物理ON）。manual を解除し一時起床期限をセット */
  | { type: "wake"; now: number; awakeMs: number }
  /** 起床中の操作。manual は変えず一時起床期限だけ延長 */
  | { type: "extend"; now: number; awakeMs: number }
  /** スケジュール上の起床帯に入った瞬間の manual 解除 */
  | { type: "clearManual" }
  /** 起床期限の再評価（manualWakeDurationMin 設定変更の反映用）*/
  | { type: "resyncAwake"; now: number; awakeMs: number };

export function sleepIntentReducer(state: SleepIntentState, action: SleepIntentAction): SleepIntentState {
  switch (action.type) {
    case "tick":
      return { ...state, now: action.now };
    case "manualSleep":
      return { ...state, manualSleeping: true, now: action.now };
    case "wake":
      return { now: action.now, awakeUntil: action.now + action.awakeMs, manualSleeping: false };
    case "extend":
      return { ...state, now: action.now, awakeUntil: action.now + action.awakeMs };
    case "clearManual":
      return state.manualSleeping ? { ...state, manualSleeping: false } : state;
    case "resyncAwake":
      // 一時起床中のときだけ期限を新しい duration で取り直す
      return state.awakeUntil > action.now
        ? { ...state, now: action.now, awakeUntil: action.now + action.awakeMs }
        : state;
  }
}

/**
 * スリープ意図を算出する（純粋関数）。
 * desiredSleeping = manualSleeping || (スケジュール上スリープ帯 && 一時起床していない)
 */
export function selectDesiredSleeping(state: SleepIntentState, settings: SleepSettings): boolean {
  const scheduleSleeping = scheduleSleepingNow(new Date(state.now), settings);
  const awake = state.now < state.awakeUntil;
  return state.manualSleeping || (scheduleSleeping && !awake);
}

export type SleepIntentActions = {
  /** 手動スリープに入る */
  manualSleep: () => void;
  /** スリープから復帰し一時起床する */
  wake: () => void;
  /** 起床中の操作で一時起床期限を延長する */
  extend: () => void;
};

export type UseSleepIntent = {
  now: number;
  desiredSleeping: boolean;
  actions: SleepIntentActions;
};

/**
 * スリープ意図の state machine。tick・スケジュール境界・設定変更への追従を内包する。
 * 物理モニター連動からの「外部ON/OFF」は wake / manualSleep を呼ぶことで反映する。
 */
export function useSleepIntent(settings: SleepSettings): UseSleepIntent {
  const [state, dispatch] = useReducer(sleepIntentReducer, undefined, () => ({
    now: Date.now(),
    awakeUntil: 0,
    manualSleeping: false,
  }));

  const awakeMs = settings.manualWakeDurationMin * 60_000;
  const desiredSleeping = selectDesiredSleeping(state, settings);

  // 時刻 tick（境界・期限の再評価用）
  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: "tick", now: Date.now() }), TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  // スケジュール起床帯の false→true エッジで manualSleeping を解除
  useEffect(() => {
    if (!state.manualSleeping) return;
    const wasAwake = scheduleAwakeNow(new Date(state.now - TICK_INTERVAL_MS), settings.windows);
    const isAwake = scheduleAwakeNow(new Date(state.now), settings.windows);
    if (!wasAwake && isAwake) dispatch({ type: "clearManual" });
  }, [state.now, state.manualSleeping, settings]);

  // 自動スリープ時間の設定変更を一時起床期限へ即反映
  useEffect(() => {
    const now = Date.now();
    if (scheduleSleepingNow(new Date(now), settings)) {
      dispatch({ type: "resyncAwake", now, awakeMs });
    }
    // manualWakeDurationMin の変化にのみ反応する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.manualWakeDurationMin]);

  const actions = useMemo<SleepIntentActions>(
    () => ({
      manualSleep: () => dispatch({ type: "manualSleep", now: Date.now() }),
      wake: () => dispatch({ type: "wake", now: Date.now(), awakeMs }),
      extend: () => dispatch({ type: "extend", now: Date.now(), awakeMs }),
    }),
    [awakeMs],
  );

  return { now: state.now, desiredSleeping, actions };
}
