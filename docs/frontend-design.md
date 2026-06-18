# フロントエンド デザインガイド

`apps/web`（Vite + React + Tailwind v4）の見た目と操作系の作り方をまとめる。新しい画面・コンポーネントを足すときはここに従うと、ダークモードやテーマ追従が自動で効き、デザインの一貫性が保たれる。

対象解像度は 1920×1080 のフルスクリーン（部屋のモニター常設用）。レスポンシブも一応効くが、最適化の主対象は大画面。

## カラートークン（最重要）

色は**直書きしない**。`apps/web/src/index.css` で定義したセマンティックトークンを使う。Tailwind v4 の `@theme inline` で CSS 変数に接続しているので、`bg-surface` / `text-ink` のようなユーティリティがそのまま使え、`data-theme` 切替で自動的にライト/ダークが入れ替わる。

利用できるトークン:

| ユーティリティ例 | 用途 |
|---|---|
| `bg-canvas` | ページ全体の背景 |
| `bg-surface` | カード・モーダルなどの面 |
| `bg-surface-muted` | ネストした面・hover・補助背景 |
| `text-ink` | 主テキスト・見出し |
| `text-ink-muted` | 副テキスト・本文補助 |
| `text-ink-subtle` | キャプション・アイコン・最も控えめな文字 |
| `border-border` | 罫線・区切り |
| `border-border-strong` | フォームコントロールなど強めの境界 |
| `text-danger` / `bg-danger-soft` / `text-danger-strong` | エラー・警告・破壊的操作 |
| `bg-success` / `text-success` | 良好・平常状態 |
| `shadow-card` | カードの影（ダークでは自動で強める） |

アクセント色は CSS 変数 `--accent` で持ち、`bg-[var(--accent)]` / `text-[var(--accent)]` / `focus:ring-[--accent]/15` のように参照する（トークンではなく変数直参照でよい）。`--accent` はテーマごとに `index.css` で定義済み。

禁止事項:
- `bg-[#xxxxxx]` などの arbitrary hex、`bg-white` / `text-black` の直書き（ダークで破綻する）
- コンポーネント内での新規 hex 定義

新しい色が必要になったら、まず既存トークンで足りないか検討する。足りなければ `index.css` の `:root` と `[data-theme="dark"]` の両方に `--c-*` を追加し、`@theme inline` に `--color-*: var(--c-*)` を1行足す。これだけで両テーマ対応のユーティリティが生える。

例外（テーマ非対象）: `sleep/SleepScreen.tsx` は常に黒画面、`debug/**` は DEV 専用オーバーレイのため、トークン移行の対象外。

## テーマ

- 状態: `theme/themeAtom.ts`（jotai `atomWithStorage`、`"system" | "light" | "dark" | "dawn"`、初期値 `system`、localStorage 永続）。具体テーマ（light/dawn/dark）の順序とラベルは同ファイルの `CONCRETE_THEMES` に集約する
- 反映: `theme/useApplyTheme.ts` を App でマウント。`system` は OS の `prefers-color-scheme`（light/dark のみ）を購読し、実効テーマを `document.documentElement.dataset.theme` に書く。`dawn` は明示選択専用で system からは解決されない
- トークン定義: `index.css` の `:root` が light のデフォルト値（`[data-theme="light"]` ブロックは存在しない）。`[data-theme="dark"]` / `[data-theme="dawn"]` が CSS 変数を上書きする
- `dawn`（朝焼け）は明るめの暖色トーン・コントラストを抑えたライト系テーマ
- 切替 UI: 右上オーバーレイの `theme/ThemeToggle.tsx`（`CONCRETE_THEMES` の順で具体テーマを1つずつサイクル。light → 朝焼け → dark → light...）と、設定モーダルの `settings/ThemeSettingsSection.tsx`（OSに従う + `CONCRETE_THEMES` の4択）

テーマに依存する分岐をコンポーネント側で書く必要は基本的にない（トークンが吸収する）。どうしても必要なら `useApplyTheme()` の戻り値（実効テーマ）を使う。

## 操作系は「オーバーレイ層」に置く

アプリ全体に対する操作（設定・スリープ・テーマ）は、特定のカード内ではなく画面右上の `controls/ControlOverlay.tsx` に集約する。新しいグローバル操作を足すときもここへ。

- `position: fixed` 右上、`z-50`（モーダルは `z-[10000]` でその上）
- ポインター操作中のみ表示（`pointermove` / `pointerdown` で出現、2秒無操作でフェードアウト）。キーボードフォーカス時も再表示する
- 非表示中は `aria-hidden` + `pointer-events-none` で操作・読み上げ対象から除外する
- ボタンは `OverlayButton`（11×11・角丸・`text-ink-subtle` → hover で `text-ink` + `bg-surface-muted`）に揃える。アイコンSVGは 22px
- 設定モーダルの開閉状態はオーバーレイが所有する

カード（`DashboardCard`）には表示専用のコンテンツのみを置き、操作ボタンを混ぜない。

## モーション（motion）

アニメーションは `motion`（`import { motion, AnimatePresence } from "motion/react"`）を使う。

- 要素の出現は「ふわっと」: `initial`→`animate` で opacity と軽い `y`/`scale`、`duration` 0.2〜0.5・`ease: "easeOut"`
- ボタンの触感: `whileHover={{ scale: 1.1 }}` / `whileTap={{ scale: 0.92 }}` を `type: "spring"` で
- アイコンの入れ替えは `AnimatePresence mode="wait"` でクロスフェード（`ThemeToggle` 参照）
- モーダルなど headlessui コンポーネントは `transition` プロップ + `data-[closed]:opacity-0` 等の CSS トランジションでよい（motion と併用しない）

過度に動かさない。常設ダッシュボードなので、出現と操作フィードバックに留める。

## カーソル

`controls/useIdleCursor.ts` を App でマウント。一定時間（既定 3 秒）ポインタ操作がなければ `html.cursor-none` を付けてカーソルを隠し、ポインタ移動・クリックで即復帰する。スリープ中は無効。クリックでトグルする方式ではない点に注意。

## コンポーネント規約

- カード: `dashboard/DashboardCard.tsx` を土台にする（`label` / `kicker` / `right` を渡すとヘッダーが出る）。非同期データは `AsyncCardBoundary` でラップ
- フォーム: `settings/components/FormControls.tsx` の `SettingField` / `TextInput` / `SelectInput` / `ActionButton`（variant: primary/secondary/ghost/danger）を使う。独自スタイルの入力要素を作らない
- 設定モーダル: `settings/SettingsModal.tsx` は headlessui `Tab` で「表示設定 / システム設定」の2タブ。設定セクションは `*SettingsSection.tsx` として切り出し、該当タブへ `Section` で並べる
- 永続化する設定は jotai `atomWithStorage`（既存の `weatherSettingsAtom` / `sleepSettingsAtom` / `themeAtom` に倣う。キーは `asamiru-*`）。ADR: `docs/adr/2026-05-30-jotai-for-module-settings.md`

## className の組み立て

クラス名の結合には `lib/cn.ts` の `cn(...)` を使う（`clsx` + `tailwind-merge` のラッパー）。

```tsx
import { cn } from "../lib/cn";

<div className={cn("base-class", condition && "conditional-class", className)} />
```

テンプレートリテラルでクラスと式を直結すると Tailwind の scanner がクラスを抽出できない（例: `` `base-class${expr}` `` は `base-class` が未生成になる）。`cn` を使えばこの問題が構造的に起きない。外部から渡された `className` で内部デフォルトを上書きする場合も `twMerge` が競合を解決する。

## レイアウト

- ルートは `Dashboard` の `<main>`（`min-h-screen bg-canvas`）。中央寄せグリッド `max-w-[1800px]`、`2xl` で3カラム構成
- ブレークポイントは Tailwind 標準。大画面（`2xl`）でカードが画面を埋めるよう `grid-rows` と `self-stretch` を併用
- フォント: 本文 `font-sans`（Noto Sans JP）、時計や数値は `font-mono`（JetBrains Mono）
