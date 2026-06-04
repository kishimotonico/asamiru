import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { SettingsModal } from "../settings/SettingsModal";
import { ThemeToggle } from "../theme/ThemeToggle";
import type { EffectiveTheme } from "../theme/themeAtom";
import { useFullscreen } from "../sleep/useFullscreen";

const HIDE_DELAY_MS = 2000;

type ControlOverlayProps = {
  effective: EffectiveTheme;
  onSleepClick?: () => void;
};

/**
 * 画面全体に対する操作層。右上に集約し、ポインター操作中のみ表示する。
 * 設定モーダルの開閉状態はこの層が所有する（アプリ全体の設定という位置づけ）。
 */
export function ControlOverlay({ effective, onSleepClick }: ControlOverlayProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const lastActivityRef = useRef(0);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    const checkHide = () => {
      const remaining = HIDE_DELAY_MS - (Date.now() - lastActivityRef.current);
      if (remaining > 0) {
        timerRef.current = window.setTimeout(checkHide, remaining);
      } else {
        visibleRef.current = false;
        setVisible(false);
      }
    };

    const onActivity = () => {
      lastActivityRef.current = Date.now();
      if (!visibleRef.current) {
        // 非表示→表示の遷移時のみ state 更新とタイマー起動
        visibleRef.current = true;
        setVisible(true);
        timerRef.current = window.setTimeout(checkHide, HIDE_DELAY_MS);
      }
      // 表示中は lastActivityRef の更新だけ。タイマーは checkHide 内で残時間を確認する
    };

    window.addEventListener("pointermove", onActivity, { passive: true });
    window.addEventListener("pointerdown", onActivity, { passive: true });
    return () => {
      window.clearTimeout(timerRef.current);
      window.removeEventListener("pointermove", onActivity);
      window.removeEventListener("pointerdown", onActivity);
    };
  }, []);

  return (
    <>
      <motion.div
        animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed right-3 top-3 z-50 flex items-center gap-1 sm:right-5 sm:top-5"
      >
        <ThemeToggle effective={effective} />
        <OverlayButton onClick={toggleFullscreen} ariaLabel={isFullscreen ? "フルスクリーン解除" : "フルスクリーン"}>
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            </svg>
          )}
        </OverlayButton>
        {onSleepClick ? (
          <OverlayButton onClick={onSleepClick} ariaLabel="モニターをOFF">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </OverlayButton>
        ) : null}
        <OverlayButton onClick={() => setSettingsOpen(true)} ariaLabel="設定">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </OverlayButton>
      </motion.div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

type OverlayButtonProps = {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
};

function OverlayButton({ onClick, ariaLabel, children }: OverlayButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      className="flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink"
    >
      {children}
    </motion.button>
  );
}
