import { useEffect, useRef } from "react";
import { isTextInputTarget } from "../lib/dom";

/** 起床直後の誤操作（wake と同じ操作が続けて延長扱いになるのを防ぐ）抑制時間 */
const INPUT_SUPPRESS_MS = 300;

export type GlobalInputHandlers = {
  /** 現在スリープ表示中か（最新値）。スリープ中の操作は activity のみを行う */
  showSleepScreen: boolean;
  /**
   * ユーザー活動（スリープ中の復帰・起床中の延長を統合）。
   * スリープ解除時も起床延長時も同じ action で処理できる（旧 onWake / onExtend の統合）。
   */
  onActivity: () => void;
  /** 手動スリープに入る（s キー）*/
  onManualSleep: () => void;
  /** フルスクリーン切替（f キー / 空白部分のダブルクリック）*/
  onToggleFullscreen: () => void;
};

/**
 * グローバルなユーザー入力（キーボード・ポインタ・ダブルクリック）を1か所で扱うフック。
 * window への capture リスナはマウント時に1度だけ登録し、最新のハンドラ・状態は ref 経由で読む。
 */
export function useGlobalInput(handlers: GlobalInputHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const suppressUntilRef = useRef(0);

  useEffect(() => {
    const activity = (nowMs: number) => {
      suppressUntilRef.current = nowMs + INPUT_SUPPRESS_MS;
      handlersRef.current.onActivity();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      const nowMs = Date.now();
      if (h.showSleepScreen) {
        activity(nowMs);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (nowMs < suppressUntilRef.current) return;
      // 入力中・ダイアログ内ではショートカットを無効化（操作としては延長扱い）
      const target = e.target;
      const inFormOrDialog =
        isTextInputTarget(target) ||
        (target instanceof HTMLElement && target.closest('[role="dialog"]') !== null);
      if (inFormOrDialog || e.ctrlKey || e.metaKey || e.altKey) {
        h.onActivity();
        return;
      }
      if (e.key === "s") {
        h.onManualSleep();
        return;
      }
      if (e.key === "f") {
        h.onToggleFullscreen();
        h.onActivity();
        return;
      }
      h.onActivity();
    };

    const onPointerDown = (e: PointerEvent) => {
      const h = handlersRef.current;
      const nowMs = Date.now();
      if (h.showSleepScreen) {
        activity(nowMs);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (nowMs < suppressUntilRef.current) return;
      h.onActivity();
    };

    const onDoubleClick = (e: MouseEvent) => {
      const h = handlersRef.current;
      const nowMs = Date.now();
      if (h.showSleepScreen) return; // 起床直後は pointerdown 側で activity 済み
      if (nowMs < suppressUntilRef.current) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        target.closest('button, input, select, textarea, a, [role="dialog"]') !== null
      ) {
        return; // カード・モーダル操作の誤爆防止。空白部分のみで発動
      }
      h.onToggleFullscreen();
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
}
