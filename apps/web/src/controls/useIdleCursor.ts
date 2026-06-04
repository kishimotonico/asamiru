import { useEffect, useRef, useState } from "react";

/** 無操作がこの時間続いたらカーソルを隠す（OS のような挙動）。 */
const IDLE_MS = 3000;

/**
 * 一定時間ポインタ操作がなければマウスカーソルを隠す。
 * ポインタ移動・クリックで即座に再表示し、タイマーを引き直す。
 * enabled=false（スリープ中など）の間は無効化し、常に表示。
 *
 * pointermove は高頻度（60fps 以上）で発火するため、ハンドラ内での
 * タイマーの破棄・再生成を避ける。最終活動時刻を ref に書くだけにして、
 * タイマーは「表示中→隠す」遷移時に1本だけ走らせる。
 */
export function useIdleCursor(enabled: boolean): void {
  const [hidden, setHidden] = useState(false);
  const hiddenRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const timerRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      hiddenRef.current = false;
      setHidden(false);
      return;
    }

    const checkIdle = () => {
      const remaining = IDLE_MS - (Date.now() - lastActivityRef.current);
      if (remaining > 0) {
        timerRef.current = window.setTimeout(checkIdle, remaining);
      } else {
        hiddenRef.current = true;
        setHidden(true);
      }
    };

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      if (hiddenRef.current) {
        // 非表示→表示の遷移時のみ state 更新とタイマー再スケジュール
        hiddenRef.current = false;
        setHidden(false);
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(checkIdle, IDLE_MS);
      }
      // 表示中は lastActivityRef の更新だけ。タイマーは checkIdle 内で残時間を確認する
    };

    timerRef.current = window.setTimeout(checkIdle, IDLE_MS);
    window.addEventListener("pointermove", onActivity, { passive: true });
    window.addEventListener("pointerdown", onActivity, { passive: true });
    return () => {
      window.clearTimeout(timerRef.current);
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("pointerdown", onActivity);
    };
  }, [enabled]);

  useEffect(() => {
    document.documentElement.classList.toggle("cursor-none", hidden);
    return () => document.documentElement.classList.remove("cursor-none");
  }, [hidden]);
}
