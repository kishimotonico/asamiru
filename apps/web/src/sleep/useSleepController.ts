import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { isTextInputTarget } from "../lib/dom";
import { scheduleSleepingNow, sleepSettingsAtom } from "./sleepSettingsAtom";
import { useFullscreen } from "./useFullscreen";

const TICK_INTERVAL_MS = 15_000;
const INPUT_SUPPRESS_MS = 300;

/**
 * スリープ状態を統括する hook。App に1つだけマウントする。
 *
 * 状態は最小: settings(永続) + awakeUntil(操作で延長される起床期限) + suppressInputUntil(復帰直後の抑止)。
 * sleeping = scheduleSleeping(now) && now >= awakeUntil。
 * window の capture-phase リスナで操作を拾い、stale closure を避けるため最新値は ref 経由で読む。
 */
export function useSleepController(): { sleeping: boolean; now: number } {
  const settings = useAtomValue(sleepSettingsAtom);
  const { toggle: toggleFullscreen } = useFullscreen();

  const [now, setNow] = useState(() => Date.now());
  // awakeUntil は描画に影響するので state。初期値 0（過去）＝初回ロードがスリープ帯なら即スリープ。
  const [awakeUntil, setAwakeUntil] = useState(0);
  const suppressInputUntilRef = useRef(0);

  const sleeping = scheduleSleepingNow(new Date(now), settings) && now >= awakeUntil;

  // ハンドラから読む最新値は ref に同期
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sleepingRef = useRef(sleeping);
  sleepingRef.current = sleeping;
  const toggleFullscreenRef = useRef(toggleFullscreen);
  toggleFullscreenRef.current = toggleFullscreen;

  // 時刻 tick（境界・期限の再評価用）
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  // グローバル操作リスナ（マウント時に1度だけ登録）
  useEffect(() => {
    // awakeUntil を変えるときは now state も同じ時刻に揃える（描画判定 now>=awakeUntil を即時に正しく反映するため）
    const setAwake = (untilMs: number, nowMs: number) => {
      setAwakeUntil(untilMs);
      setNow(nowMs);
    };
    const extend = (nowMs: number) => {
      setAwake(nowMs + settingsRef.current.manualWakeDurationMin * 60_000, nowMs);
    };
    const wake = (nowMs: number) => {
      extend(nowMs);
      suppressInputUntilRef.current = nowMs + INPUT_SUPPRESS_MS;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const nowMs = Date.now();
      if (sleepingRef.current) {
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
        setAwake(nowMs, nowMs); // 今すぐ寝かせる（延長しない）
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
      if (sleepingRef.current) {
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
      if (sleepingRef.current) return; // 起床直後は pointerdown 側で wake 済み
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

  return { sleeping, now };
}
