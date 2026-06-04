import { useEffect, useRef, useState } from "react";

/** 操作可能な要素。これらの上のクリックではトグルせず、必ずカーソルを表示へ戻す。 */
const INTERACTIVE_SELECTOR = 'button, input, select, textarea, a, [role="dialog"]';

/**
 * 背景（空白部分）クリックでマウスカーソルの表示/非表示をトグルする。
 * - 空白クリック: hidden をトグル（もう一度クリックで復活）
 * - ボタン/フォーム/モーダル上のクリック: 常に表示へ戻す
 * - enabled=false（スリープ中など）の間は無効化し、常に表示
 */
export function useCursorToggle(enabled: boolean): void {
  const [hidden, setHidden] = useState(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) setHidden(false);
  }, [enabled]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!enabledRef.current) return;
      const target = e.target;
      const onInteractive =
        target instanceof HTMLElement && target.closest(INTERACTIVE_SELECTOR) !== null;
      if (onInteractive) {
        setHidden(false);
        return;
      }
      setHidden((prev) => !prev);
    };

    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => window.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("cursor-none", hidden);
    return () => document.documentElement.classList.remove("cursor-none");
  }, [hidden]);
}
