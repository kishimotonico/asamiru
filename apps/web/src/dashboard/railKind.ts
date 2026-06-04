/**
 * 京王線 列車種別バッジのスタイルマッピング
 *
 * 種別名は API 側 apps/api/src/departures.ts の serviceLabel() の戻り値に合わせている。
 * 種別を追加・変更する場合は serviceLabel() も確認すること。
 */

type RailKindBadge = {
  /** バッジの背景クラス（Tailwind ユーティリティ or カスタムクラス） */
  bg: string;
  /** バッジの文字色クラス */
  fg: string;
};

const DEFAULT_BADGE: RailKindBadge = {
  bg: "bg-surface-muted",
  fg: "text-ink-muted",
};

/**
 * 種別名 → バッジスタイルのマッピング
 *
 * 色値は :root の --c-rail-* 変数（apps/web/src/index.css）で管理。
 * 路線図準拠のブランドカラーのためライト/ダーク共通の固定色を使用。
 */
const KIND_MAP: Record<string, RailKindBadge> = {
  特急: { bg: "bg-rail-express", fg: "text-white" },
  準特急: { bg: "bg-rail-semi-express-limited", fg: "text-white" }, // 2022年廃止種別
  急行: { bg: "bg-rail-express2", fg: "text-white" },
  区間急行: { bg: "bg-rail-semi-express", fg: "text-white" },
  快速: { bg: "bg-rail-rapid", fg: "text-white" },
  // 京王ライナー・Mt.TAKAO号はグラデーション背景（.rail-badge--liner で定義）
  京王ライナー: { bg: "rail-badge--liner", fg: "text-white" },
  "Mt.TAKAO号": { bg: "rail-badge--liner", fg: "text-white" }, // 京王ライナーと同じ凡例
};

/** 表記揺れを正規化する（timetable.ts 由来の種別名が serviceLabel() と異なる場合を吸収） */
function normalize(kind: string): string {
  const trimmed = kind.trim();
  if (trimmed === "各停") return "各駅停車";
  return trimmed;
}

/**
 * 種別名からバッジのスタイル情報を返す。
 * 未知の種別・各駅停車・回送・臨時はデフォルト（グレー）にフォールバック。
 */
export function railKindBadge(kind: string): RailKindBadge {
  const normalized = normalize(kind);
  return KIND_MAP[normalized] ?? DEFAULT_BADGE;
}
