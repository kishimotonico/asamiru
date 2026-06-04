# 京王線 列車種別バッジの色分け実装

## 概要

交通カードの発着列車バッジが全種別グレー一律だったのを、京王線路線図準拠の種別カラーで色分けした。

## 変更ファイル

- `apps/web/src/index.css` — 種別カラー CSS 変数（`--c-rail-*`）とトークン定義を追加
- `apps/web/src/dashboard/railKind.ts` — 新規。種別名 → バッジスタイルのマッピング関数
- `apps/web/src/dashboard/TrainsCard.tsx` — `railKindBadge()` を使ってバッジ色を適用

## 設計方針

- 種別色は路線図のブランドカラーとして扱い、ライト/ダーク共通の固定色（テーマで反転させない）
- 各駅停車・回送・臨時・未知種別はグレー（`bg-surface-muted`）にフォールバック
- 京王ライナーは特殊な2色グラデーション（`.rail-badge--liner` カスタムクラス）
- 色の直書き禁止規約に従い、hex は `index.css` の `--c-rail-*` に集約して `@theme inline` でユーティリティクラスに昇格

## 色値について

**現在は仮値（プレースホルダ）**。お兄ちゃんが京王HPの路線図からスポイトして提供予定。
差し替え箇所は `apps/web/src/index.css` の `:root` 内 `--c-rail-*` 変数（TODO コメントあり）。

| 変数名 | 種別 | 仮値 |
|---|---|---|
| `--c-rail-express` | 特急 | `#cc0000` |
| `--c-rail-semi-express-limited` | 準特急（廃止） | `#e87200` |
| `--c-rail-express2` | 急行 | `#009a44` |
| `--c-rail-semi-express` | 区間急行 | `#0080c0` |
| `--c-rail-rapid` | 快速 | `#0050a0` |
| `--c-rail-liner-from` | 京王ライナー（開始） | `#a08000` |
| `--c-rail-liner-to` | 京王ライナー（終了） | `#1a3c5e` |

## 動作確認

- ライト/ダーク両テーマで特急（赤）・快速（青）・各駅停車（グレー）が正しく表示されることをブラウザで確認済み
- TypeScript 型チェック（`tsc --noEmit`）通過
