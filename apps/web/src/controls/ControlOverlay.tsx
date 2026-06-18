import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "../lib/cn";
import { SettingsModal } from "../settings/SettingsModal";
import { ThemeToggle } from "../theme/ThemeToggle";
import type { EffectiveTheme } from "../theme/themeAtom";
import { useFullscreen } from "../sleep/useFullscreen";

const HIDE_DELAY_MS = 2000;

type ControlOverlayProps = {
  effective: EffectiveTheme;
  onSleepClick?: () => void;
  debugOpen?: boolean;
  onDebugClick?: () => void;
};

/**
 * 画面全体に対する操作層。右上に集約し、ポインター操作中のみ表示する。
 * 設定モーダルの開閉状態はこの層が所有する（アプリ全体の設定という位置づけ）。
 */
export function ControlOverlay({ effective, onSleepClick, debugOpen = false, onDebugClick }: ControlOverlayProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const lastActivityRef = useRef(0);
  const timerRef = useRef<number>(0);
  const onActivityRef = useRef<() => void>(() => {});

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
        visibleRef.current = true;
        setVisible(true);
        timerRef.current = window.setTimeout(checkHide, HIDE_DELAY_MS);
      }
    };

    // onActivity を外から参照できるよう ref に保持（onFocus ハンドラで使用）
    onActivityRef.current = onActivity;

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
        onFocus={() => onActivityRef.current()}
        aria-hidden={!visible}
        animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn("fixed right-3 top-3 z-50 flex items-center gap-1 sm:right-5 sm:top-5", !visible && "pointer-events-none")}
      >
        <ThemeToggle effective={effective} />
        <OverlayButton onClick={toggleFullscreen} ariaLabel={isFullscreen ? "フルスクリーン解除" : "フルスクリーン"}>
          {isFullscreen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3" />
              <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
              <path d="M3 16h3a2 2 0 0 1 2 2v3" />
              <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            </svg>
          )}
        </OverlayButton>
        {onSleepClick ? (
          <OverlayButton onClick={onSleepClick} ariaLabel="モニターをOFF">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
              <line x1="12" y1="2" x2="12" y2="12" />
            </svg>
          </OverlayButton>
        ) : null}
        {onDebugClick ? (
          <OverlayButton onClick={onDebugClick} ariaLabel={debugOpen ? "デバッグを閉じる" : "デバッグ"} pressed={debugOpen}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 2 1.9 1.9" />
              <path d="M14.1 3.9 16 2" />
              <path d="M9 7V6a3 3 0 0 1 6 0v1" />
              <path d="M8 9h8" />
              <path d="M7 13H4" />
              <path d="M20 13h-3" />
              <path d="M7 17H4" />
              <path d="M20 17h-3" />
              <rect x="7" y="7" width="10" height="14" rx="4" />
            </svg>
          </OverlayButton>
        ) : null}
        <OverlayButton onClick={() => setSettingsOpen(true)} ariaLabel="設定">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  pressed?: boolean;
  children: React.ReactNode;
};

function OverlayButton({ onClick, ariaLabel, pressed, children }: OverlayButtonProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      // damping は 30（減衰比 0.75）で軽くバウンドさせつつ震えを抑える
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink",
        pressed && "bg-surface-muted text-ink",
      )}
    >
      {children}
    </motion.button>
  );
}
