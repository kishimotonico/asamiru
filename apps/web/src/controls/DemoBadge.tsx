import { motion } from "motion/react";

/**
 * デモモード（VITE_DEMO_MODE=true）のときだけ表示する控えめなバッジ。
 * 鉄道データはダミーで天気のみライブであることをユーザーに伝える。
 * 左下固定で ControlOverlay（右上）と競合しない。
 */
export function DemoBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 1 }}
      className="fixed bottom-4 left-4 z-50 rounded-md border border-border bg-surface-muted px-2.5 py-1 text-xs text-ink-subtle"
    >
      DEMO
    </motion.div>
  );
}
