/**
 * 京王線 列車種別バッジのスタイル。
 * 特別列車（京王ライナー・Mt.TAKAO号）のみ専用スタイルを返し、それ以外はデフォルト。
 */

type RailKindBadge = {
  bg: string;
  fg: string;
};

const DEFAULT_BADGE: RailKindBadge = {
  bg: "bg-surface-muted",
  fg: "text-ink-muted",
};

const LINER_BADGE: RailKindBadge = {
  bg: "rail-badge--liner",
  fg: "text-white",
};

const LINER_KINDS = new Set(["京王ライナー", "Mt.TAKAO号"]);

export function railKindBadge(kind: string): RailKindBadge {
  return LINER_KINDS.has(kind.trim()) ? LINER_BADGE : DEFAULT_BADGE;
}
