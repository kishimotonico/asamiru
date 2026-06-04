import { useEffect, useState } from "react";

/** 無操作がこの時間続いたらカーソルを隠す（OS のような挙動）。 */
const IDLE_MS = 3000;

/**
 * 一定時間ポインタ操作がなければマウスカーソルを隠す。
 * ポインタ移動・クリックで即座に再表示し、タイマーを引き直す。
 * enabled=false（スリープ中など）の間は無効化し、常に表示。
 */
export function useIdleCursor(enabled: boolean): void {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }

    let timerId = 0;
    const schedule = () => {
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => setHidden(true), IDLE_MS);
    };
    const onActivity = () => {
      setHidden(false);
      schedule();
    };

    schedule();
    window.addEventListener("pointermove", onActivity, { passive: true });
    window.addEventListener("pointerdown", onActivity, { passive: true });
    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("pointerdown", onActivity);
    };
  }, [enabled]);

  useEffect(() => {
    document.documentElement.classList.toggle("cursor-none", hidden);
    return () => document.documentElement.classList.remove("cursor-none");
  }, [hidden]);
}
