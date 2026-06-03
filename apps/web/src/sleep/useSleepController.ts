import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { isTextInputTarget } from "../lib/dom";
import { scheduleAwakeNow, scheduleSleepingNow, sleepSettingsAtom } from "./sleepSettingsAtom";
import { useFullscreen } from "./useFullscreen";
import { fetchDisplayStatus, putDesiredPower, subscribeDisplayEvents } from "../data/display";
import type { DisplayPower } from "@asamiru/shared";

const TICK_INTERVAL_MS = 15_000;
const INPUT_SUPPRESS_MS = 300;

/**
 * スリープ状態を統括する hook。App に1つだけマウントする。
 *
 * - Web はアプリのスリープ意図（スケジュール・一時起床・手動スリープ）の正。
 * - モニター電源制御が有効な場合、desiredSleeping の遷移で desired-power を送る。
 * - 物理 ON/OFF（powerOrigin=external）を入力操作として反映する。
 *
 * sleeping = scheduleSleeping(now) && now >= awakeUntil
 * desiredSleeping = manualSleeping || sleeping
 * effectiveSleeping = desiredSleeping || (displayEnabled && displayPower === "off")
 */
export function useSleepController(): { sleeping: boolean; now: number } {
  const settings = useAtomValue(sleepSettingsAtom);
  const { toggle: toggleFullscreen } = useFullscreen();

  const [now, setNow] = useState(() => Date.now());
  const [awakeUntil, setAwakeUntil] = useState(0);
  const [manualSleeping, setManualSleeping] = useState(false);
  const [displayPower, setDisplayPower] = useState<DisplayPower>("unknown");
  const [displayEnabled, setDisplayEnabled] = useState(false);
  const suppressInputUntilRef = useRef(0);

  // スケジュール上スリープすべきか
  const scheduleSleeping = scheduleSleepingNow(new Date(now), settings);
  // ユーザー操作で起床中か
  const awake = now < awakeUntil;
  // アプリのスリープ意図
  const desiredSleeping = manualSleeping || (scheduleSleeping && !awake);
  // モニターが明示的にOFFの場合はスリープ扱い（display 無効時は unknown なので影響しない）
  const displayUnavailable = displayEnabled && displayPower === "off";
  const effectiveSleeping = desiredSleeping || displayUnavailable;

  // ハンドラから読む最新値は ref に同期
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const effectiveSleepingRef = useRef(effectiveSleeping);
  effectiveSleepingRef.current = effectiveSleeping;
  const toggleFullscreenRef = useRef(toggleFullscreen);
  toggleFullscreenRef.current = toggleFullscreen;
  const awakeUntilRef = useRef(awakeUntil);
  awakeUntilRef.current = awakeUntil;
  const manualSleepingRef = useRef(manualSleeping);
  manualSleepingRef.current = manualSleeping;
  const desiredSleepingRef = useRef(desiredSleeping);
  desiredSleepingRef.current = desiredSleeping;
  const displayPowerRef = useRef(displayPower);
  displayPowerRef.current = displayPower;
  const displayEnabledRef = useRef(displayEnabled);
  displayEnabledRef.current = displayEnabled;

  // 時刻 tick（境界・期限の再評価用）
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  // scheduleAwakeNow の false→true エッジで manualSleeping を解除
  useEffect(() => {
    if (!manualSleeping) return;
    const wasScheduleAwake = scheduleAwakeNow(new Date(now - TICK_INTERVAL_MS), settings.windows);
    const isScheduleAwake = scheduleAwakeNow(new Date(now), settings.windows);
    if (!wasScheduleAwake && isScheduleAwake) {
      setManualSleeping(false);
    }
  }, [now, manualSleeping, settings]);

  // 自動スリープ時間の設定変更を一時起床にも即反映
  useEffect(() => {
    const nowMs = Date.now();
    if (awakeUntilRef.current > nowMs && scheduleSleepingNow(new Date(nowMs), settingsRef.current)) {
      setAwakeUntil(nowMs + settingsRef.current.manualWakeDurationMin * 60_000);
      setNow(nowMs);
    }
  }, [settings.manualWakeDurationMin]);

  // desired power 送信（desiredSleeping の変化時、および display 有効化時）。
  // displayEnabled を依存に含めることで、起動時に後から有効化されても現在の意図を同期する。
  useEffect(() => {
    if (!displayEnabled) return;
    const desired = desiredSleeping ? "standby" : "on";
    const targetPower = desired === "standby" ? "off" : "on";
    // 観測値と一致するなら送らない（skip-if-matches）
    if (displayPowerRef.current === targetPower) return;
    putDesiredPower(desired).catch((err) => {
      // モニター制御失敗はスリープを失敗させない
      console.warn("[display] putDesiredPower failed:", err);
    });
  }, [desiredSleeping, displayEnabled]);

  // モニター制御連動（マウント時に1度だけ設定）
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    // 物理 ON/OFF をユーザー操作としてスリープ意図へ反映する（リアルタイムの external イベント用）
    const applyExternalPower = (power: DisplayPower) => {
      if (power === "off") {
        setManualSleeping(true);
      } else if (power === "on") {
        const nowMs = Date.now();
        setManualSleeping(false);
        setAwakeUntil(nowMs + settingsRef.current.manualWakeDurationMin * 60_000);
        setNow(nowMs);
      }
    };

    // 起動時の初回同期。スリープ意図は変えず、有効状態と観測 power をセットするだけ。
    // 実際の待機・復帰は desired power 送信 Effect が現在の意図に基づいて行う。
    // （起動時にモニターが ON でも「物理 ON 操作」とは扱わない。就寝帯なら standby が送られる）
    async function initDisplayStatus(): Promise<boolean> {
      try {
        const info = await fetchDisplayStatus();
        if (!info.enabled) {
          console.info("[display] monitor integration is disabled");
          return false;
        }
        console.info(
          `[display] initial status power=${info.power} origin=${info.powerOrigin} connection=${info.connection}`,
        );
        setDisplayEnabled(true);
        setDisplayPower(info.power);
        return true;
      } catch (err) {
        console.warn("[display] fetchDisplayStatus failed:", err);
        return false;
      }
    }

    // SSE 再接続時の再同期。切断中に起きた物理操作を、最後に観測した power との
    // 実差分として検知する（瞬間値の powerOrigin には頼らない）。
    async function reconcileOnReconnect() {
      try {
        const info = await fetchDisplayStatus();
        if (!info.enabled) return;
        const prev = displayPowerRef.current;
        setDisplayPower(info.power);
        if (prev !== "unknown" && info.power !== "unknown" && info.power !== prev) {
          applyExternalPower(info.power);
        }
      } catch (err) {
        console.warn("[display] fetchDisplayStatus failed:", err);
      }
    }

    function setupSubscription() {
      console.info("[display] subscribing to monitor events");
      const sub = subscribeDisplayEvents({
        onStatus: (status) => {
          console.info(
            `[display] event power=${status.power} origin=${status.powerOrigin} connection=${status.connection}`,
          );
          setDisplayPower(status.power);
          // 外部操作のみスリープ意図へ反映（command/unknown は無視）
          if (status.powerOrigin === "external") {
            console.info(`[display] applying external power=${status.power}`);
            applyExternalPower(status.power);
          }
        },
        onReconnect: () => {
          console.info("[display] monitor event stream connected");
          void reconcileOnReconnect();
        },
      });
      cleanup = sub.unsubscribe;
    }

    void initDisplayStatus().then((enabled) => {
      // setDisplayEnabled() の React state 反映前でも、GET の結果に基づいて購読を開始する。
      // ref を見ると初回レンダーの false が残り、SSE 購読が開始されない場合がある。
      if (enabled) setupSubscription();
    });

    return () => {
      cleanup?.();
    };
  // マウント時だけ実行
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // グローバル操作リスナ（マウント時に1度だけ登録）
  useEffect(() => {
    const setAwake = (untilMs: number, nowMs: number) => {
      setAwakeUntil(untilMs);
      setNow(nowMs);
    };
    const extend = (nowMs: number) => {
      setAwake(nowMs + settingsRef.current.manualWakeDurationMin * 60_000, nowMs);
    };
    const wake = (nowMs: number) => {
      setManualSleeping(false);
      extend(nowMs);
      suppressInputUntilRef.current = nowMs + INPUT_SUPPRESS_MS;
      // displayUnavailable（モニターOFF）でスリープしていた場合は、desiredSleeping が
      // 既に false で送信 Effect が再実行されないため、明示的に復帰要求を送る。
      // 自動復帰コマンドが失敗していたケースの再試行手段になる。
      if (displayEnabledRef.current && displayPowerRef.current === "off") {
        putDesiredPower("on").catch((err) => {
          console.warn("[display] putDesiredPower failed:", err);
        });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const nowMs = Date.now();
      if (effectiveSleepingRef.current) {
        wake(nowMs);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (nowMs < suppressInputUntilRef.current) return;
      // 入力中・ダイアログ内ではショートカットを無効化（操作としては延長扱い）
      const target = e.target;
      const inFormOrDialog =
        isTextInputTarget(target) ||
        (target instanceof HTMLElement && target.closest('[role="dialog"]') !== null);
      if (inFormOrDialog || e.ctrlKey || e.metaKey || e.altKey) {
        extend(nowMs);
        return;
      }
      if (e.key === "s") {
        // 手動スリープ: manualSleeping=true で起床帯でもスリープを維持
        setManualSleeping(true);
        setNow(nowMs);
        return;
      }
      if (e.key === "f") {
        toggleFullscreenRef.current();
        extend(nowMs);
        return;
      }
      extend(nowMs);
    };

    const onPointerDown = (e: PointerEvent) => {
      const nowMs = Date.now();
      if (effectiveSleepingRef.current) {
        wake(nowMs);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (nowMs < suppressInputUntilRef.current) return;
      extend(nowMs);
    };

    const onDoubleClick = (e: MouseEvent) => {
      const nowMs = Date.now();
      if (effectiveSleepingRef.current) return; // 起床直後は pointerdown 側で wake 済み
      if (nowMs < suppressInputUntilRef.current) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest('button, input, select, textarea, a, [role="dialog"]') !== null
      ) {
        return; // カード・モーダル操作の誤爆防止。空白部分のみで発動
      }
      toggleFullscreenRef.current();
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("dblclick", onDoubleClick, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("pointerdown", onPointerDown, { capture: true });
      window.removeEventListener("dblclick", onDoubleClick, { capture: true });
    };
  }, []);

  return { sleeping: effectiveSleeping, now };
}
