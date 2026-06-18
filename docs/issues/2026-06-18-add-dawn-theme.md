# 新テーマ「朝焼け（dawn）」の追加

## 背景

テーマは `system | light | dark` の3択だった。明るめ・暖色でコントラストを抑えたライト系の新テーマ「朝焼け（dawn）」を追加する。
`system` は OS の light/dark にしか解決できないため、dawn は明示選択専用とする。

## 方針

既存の `[data-theme]` 切り替え構造（`:root` が light のデフォルト値、`[data-theme="dark"]` が上書き）に
`[data-theme="dawn"]` ブロックを追加する形で素直に拡張した。`ThemePreference` / `EffectiveTheme` に `"dawn"` を足し、
具体テーマ（light/dawn/dark）の順序とラベルを `CONCRETE_THEMES` として1か所に集約。`ThemeToggle` と
`ThemeSettingsSection` の両方がこれを参照することで、テーマを今後追加する際の表示順・ラベルの不整合を防ぐ。

`ThemeToggle` は「実効テーマの逆を明示セットする二値トグル」から「`CONCRETE_THEMES` の順で具体テーマを
1つずつサイクルするボタン」に変更（light → 朝焼け → dark → light...）。3値になったため二値トグルは成立しない。

## パレット（dawn）

`apps/web/src/index.css` の `[data-theme="dawn"]`:

| トークン | 値 |
| --- | --- |
| `--c-canvas` | `#fff4ea` |
| `--c-surface` | `#fffaf5` |
| `--c-surface-muted` | `#fdeede` |
| `--c-ink` | `#3a2a22` |
| `--c-ink-muted` | `#7a6253` |
| `--c-ink-subtle` | `#b09a86` |
| `--c-border` | `#f0e0cf` |
| `--c-border-strong` | `#e2cdb6` |
| `--c-danger` / `--c-danger-strong` / `--c-danger-soft` | `#c14b3a` / `#9a3d30` / `#fbeae2` |
| `--c-success` | `#cfe0bf` |
| `--c-shadow-card` | `0 1px 0 rgba(120,70,30,.05), 0 6px 24px -16px rgba(120,70,30,.22)` |
| `--accent` | `#d98a4e` |
| `color-scheme` | `light` |

`--c-rail-liner-from/to` は `:root` から継承するため dawn では再定義していない。

## 変更ファイル

- `apps/web/src/theme/themeAtom.ts` — `ThemePreference` / `EffectiveTheme` に `"dawn"` を追加、`isThemePreference` 対応、`CONCRETE_THEMES`（light/dawn/dark の順序・ラベル）を新規export
- `apps/web/src/theme/useApplyTheme.ts` — コメントを light/dawn/dark 表現に更新（ロジックは型ナローイングでそのまま通る）
- `apps/web/src/index.css` — `[data-theme="dawn"]` ブロックを追加
- `apps/web/src/theme/ThemeToggle.tsx` — 二値トグル→`CONCRETE_THEMES` を順にサイクルする方式に変更。dawn 用に日の出アイコン（地平線＋半円の太陽＋光線）を追加。`aria-label` は次に切り替わるテーマ名を表示
- `apps/web/src/settings/ThemeSettingsSection.tsx` — `OPTIONS` を `CONCRETE_THEMES` 流用（`OSに従う` を先頭に結合）に変更、description を dawn 追加に合わせて更新
- `apps/web/src/controls/ControlOverlay.tsx` — 変更なし（`EffectiveTheme` の型が通ることのみ確認）
- `docs/frontend-design.md` — 「## テーマ」節を新仕様（4値・`CONCRETE_THEMES`・サイクル挙動・`:root`=light デフォルト構造）に更新

## 検証

- `pnpm --filter web exec tsc -b`: パス
- `pnpm lint`: パス（`eslint .` エラーなし）
