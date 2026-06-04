import { useState } from "react";
import { motion } from "motion/react";
import { SettingsModal } from "../settings/SettingsModal";
import { ThemeToggle } from "../theme/ThemeToggle";
import type { EffectiveTheme } from "../theme/themeAtom";

type ControlOverlayProps = {
  effective: EffectiveTheme;
  onSleepClick?: () => void;
};

/**
 * 画面全体に対する操作層。右上に集約し、通常はほぼ目立たず hover/focus で明確化する。
 * 設定モーダルの開閉状態はこの層が所有する（アプリ全体の設定という位置づけ）。
 */
export function ControlOverlay({ effective, onSleepClick }: ControlOverlayProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="group fixed right-3 top-3 z-50 flex items-center gap-1 opacity-35 transition-opacity duration-300 focus-within:opacity-100 hover:opacity-100 sm:right-5 sm:top-5"
      >
        <ThemeToggle effective={effective} />
        {onSleepClick ? (
          <OverlayButton onClick={onSleepClick} ariaLabel="モニターをOFF">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
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
