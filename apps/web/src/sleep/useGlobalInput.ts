import { useEffect, useRef } from "react";
import { isTextInputTarget } from "../lib/dom";

/** 起床直後の誤操作（wake と同じ操作が続けて延長扱いになるのを防ぐ）抑制時間 */
const INPUT_SUPPRESS_MS = 300;

export type GlobalInputHandlers = {
  /** 現在スリープ表示中か（最新値）。スリープ中の操作は wake のみを行う */
  effectiveSleeping: boolean;
  /** スリープから復帰する */
  onWake: () => void;
  /** 起床中の操作で一時起床を延長する */
  onExtend: () => void;
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
    const wake = (nowMs: number) => {
      suppressUntilRef.current = nowMs + INPUT_SUPPRESS_MS;
      handlersRef.current.onWake();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current;
      const nowMs = Date.now();
      if (h.effectiveSleeping) {
        wake(nowMs);
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
        h.onExtend();
        return;
      }
      if (e.key === "s") {
        h.onManualSleep();
        return;
      }
      if (e.key === "f") {
        h.onToggleFullscreen();
        h.onExtend();
        return;
      }
      h.onExtend();
    };

    const onPointerDown = (e: PointerEvent) => {
      const h = handlersRef.current;
      const nowMs = Date.now();
      if (h.effectiveSleeping) {
        wake(nowMs);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (nowMs < suppressUntilRef.current) return;
      h.onExtend();
    };

    const onDoubleClick = (e: MouseEvent) => {
      const h = handlersRef.current;
      const nowMs = Date.now();
      if (h.effectiveSleeping) return; // 起床直後は pointerdown 側で wake 済み
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
