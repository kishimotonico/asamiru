import { useSetAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import type { EffectiveTheme } from "./themeAtom";
import { themeAtom } from "./themeAtom";

type ThemeToggleProps = {
  effective: EffectiveTheme;
  className?: string;
};

/** 現在の実効テーマの逆を明示セットするトグル。アイコンは sun/moon を motion でクロスフェード。 */
export function ThemeToggle({ effective, className = "" }: ThemeToggleProps) {
  const setTheme = useSetAtom(themeAtom);
  const isDark = effective === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink ${className}`}
      aria-label={isDark ? "ライトモードに切替" : "ダークモードに切替"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {isDark ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
