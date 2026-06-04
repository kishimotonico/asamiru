import { useEffect, useMemo, useReducer } from "react";
import {
  nextScheduleWakeStartAfter,
  scheduleSleepingNow,
  type SleepSettings,
} from "./sleepSettingsAtom";

export const TICK_INTERVAL_MS = 15_000;

/**
 * アプリの「スリープ意図」を表す判別共用体。
 * - schedule: スケジュールに従う（既定状態）
 * - tempAwake: 操作による期限つき一時起床
 * - forcedSleep: 手動/外部OFFによる強制スリープ。releaseAt で自動解除（null は操作/外部ONのみ）
 */
export type SleepIntent =
  | { mode: "schedule" }
  | { mode: "tempAwake"; until: number }
  | { mode: "forcedSleep"; releaseAt: number | null };

export type SleepIntentState = {
  /** 境界・期限の再評価に使う現在時刻（tick で更新） */
  now: number;
  intent: SleepIntent;
};

export type SleepIntentAction =
  | { type: "tick"; now: number }
  /** 操作 / 外部ON（旧 wake + extend を統合） */
  | { type: "activity"; now: number; awakeMs: number }
  /** 手動スリープ / 外部OFF / s キー */
  | { type: "forceSleep"; now: number; releaseAt: number | null }
  /** 設定変更の反映（tempAwake.until と forcedSleep.releaseAt を取り直す） */
  | { type: "resync"; now: number; awakeMs: number; releaseAt: number | null };

export function sleepIntentReducer(state: SleepIntentState, action: SleepIntentAction): SleepIntentState {
  switch (action.type) {
    case "tick": {
      const { now } = action;
      let intent = state.intent;
      // tempAwake 失効: schedule へ正規化
      if (intent.mode === "tempAwake" && now >= intent.until) {
        intent = { mode: "schedule" };
      }
      // forcedSleep 解除時刻到達: schedule へ正規化
      if (intent.mode === "forcedSleep" && intent.releaseAt !== null && now >= intent.releaseAt) {
        intent = { mode: "schedule" };
      }
      return { now, intent };
    }
    case "activity":
      return { now: action.now, intent: { mode: "tempAwake", until: action.now + action.awakeMs } };
    case "forceSleep":
      return { now: action.now, intent: { mode: "forcedSleep", releaseAt: action.releaseAt } };
    case "resync": {
      const { now, awakeMs, releaseAt } = action;
      if (state.intent.mode === "tempAwake") {
        return { now, intent: { mode: "tempAwake", until: now + awakeMs } };
      }
      if (state.intent.mode === "forcedSleep") {
        return { now, intent: { mode: "forcedSleep", releaseAt } };
      }
      // schedule は無変化（now も更新しない）
      return state;
    }
  }
}

/**
 * スリープ意図から「スリープすべきか」を算出する（純粋関数）。
 *
 * - forcedSleep: releaseAt 未到達なら true、到達後はスケジュール評価
 * - tempAwake: until 未到達なら false、失効後はスケジュール評価
 * - schedule: scheduleSleepingNow で評価
 *
 * tick が走る前のレンダーでも正しく評価できるよう、失効/解除の判定を reducer と冗長に持つ。
 */
export function selectDesiredSleeping(s: SleepIntentState, settings: SleepSettings): boolean {
  switch (s.intent.mode) {
    case "forcedSleep":
      return s.intent.releaseAt !== null && s.now >= s.intent.releaseAt
        ? scheduleSleepingNow(new Date(s.now), settings)
        : true;
    case "tempAwake":
      return s.now < s.intent.until ? false : scheduleSleepingNow(new Date(s.now), settings);
    case "schedule":
      return scheduleSleepingNow(new Date(s.now), settings);
  }
}

export type SleepIntentActions = {
  /** 操作 / 外部ON（スリープ中の復帰・起床中の延長を統合）*/
  activity: () => void;
  /** 手動スリープ / 外部OFF */
  forceSleep: () => void;
};

export type UseSleepIntent = {
  now: number;
  desiredSleeping: boolean;
  actions: SleepIntentActions;
};

/**
 * スリープ意図のステートマシン。tick・設定変更への追従を内包する。
 * 物理モニター連動からの「外部ON/OFF」は activity / forceSleep を呼ぶことで反映する。
 */
export function useSleepIntent(settings: SleepSettings): UseSleepIntent {
  const [state, dispatch] = useReducer(sleepIntentReducer, undefined, () => ({
    now: Date.now(),
    intent: { mode: "schedule" } as SleepIntent,
  }));

  const awakeMs = settings.manualWakeDurationMin * 60_000;
  const desiredSleeping = selectDesiredSleeping(state, settings);

  // 時刻 tick（境界・期限の再評価用）
  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: "tick", now: Date.now() }), TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  // 設定変更を現在の intent へ即反映（resync）
  // - tempAwake 中: until を新しい duration で取り直す（スケジュール内外を問わず反映）
  // - forcedSleep 中: releaseAt を nextScheduleWakeStartAfter で取り直す
  // - schedule 中: 無変化
  useEffect(() => {
    const now = Date.now();
    const releaseAt = settings.enabled
      ? nextScheduleWakeStartAfter(new Date(now), settings.windows)
      : null;
    dispatch({ type: "resync", now, awakeMs, releaseAt });
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const actions = useMemo<SleepIntentActions>(
    () => ({
      activity: () => dispatch({ type: "activity", now: Date.now(), awakeMs }),
      forceSleep: () => {
        const now = Date.now();
        const releaseAt = settings.enabled
          ? nextScheduleWakeStartAfter(new Date(now), settings.windows)
          : null;
        dispatch({ type: "forceSleep", now, releaseAt });
      },
    }),
    // awakeMs / settings の変化で action クロージャを再生成
    [awakeMs, settings], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { now: state.now, desiredSleeping, actions };
}
