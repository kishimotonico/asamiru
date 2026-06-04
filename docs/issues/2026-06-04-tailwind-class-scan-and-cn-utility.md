# Tailwind クラスがテンプレートリテラル直結で生成されない問題と cn ユーティリティ導入

日付: 2026-06-04  
関連ファイル: `apps/web/src/dashboard/ClockCard.tsx`, `apps/web/src/controls/ControlOverlay.tsx`, `apps/web/src/lib/cn.ts` ほか  
コミット: `00aab66`（誤った回避策）→ 本対応で訂正

## 概要

時計カードを 2xl（≥96rem）で最小高さ 28rem に固定しようとしたところ `2xl:min-h-[28rem]` の CSS が生成されず、当初これを「Tailwind v4.3.0 の `@utility` がレスポンシブ variant で生成されないバグ」と誤って結論づけた（`@layer utilities` で生セレクターを直書きする回避策を採用）。

Codex のレビューで原因分析が誤りと判明。真因は Tailwind のバグではなく、テンプレートリテラルで固定クラスと式を直結すると Tailwind の scanner がクラスを抽出できないことだった。

## 真因

`ClockCard.tsx` の className 結合で、`2xl:min-h-clock` の直後に `${` が直結していた:

```tsx
className={`... 2xl:min-h-clock${className ? ` ${className}` : ""}`}
```

Tailwind v4 の scanner はソースを静的にスキャンしてクラス候補を抽出するが、`2xl:min-h-clock${` のように識別子の直後に `$`/`{` が続くと、その固定クラスを候補として切り出せない。結果、対応する CSS が生成されない。

同じ直結が `ControlOverlay.tsx` にもあった（`sm:top-5${...}`）。こちらは `sm:top-5` が未生成で、sm 以上でオーバーレイ位置が崩れる潜在バグになっていた。

### 裏付け

- 調査中に `min-h-clock 2xl:min-h-clock${...}` と書いたとき、空白で囲まれた `2xl:min-h-clock` は生成され、末尾 `${` 直結の `min-h-clock` は未生成だった。「base class が無いと variant が生成されない」という当初仮説では、base である `min-h-clock` 自体が未生成だった事実を説明できない。「直結したクラスは scanner に拾われない」なら全て説明できる
- リポジトリ内の他の結合箇所（`DashboardCard.tsx`、`ThemeToggle.tsx`、`FormControls.tsx`）は全て `固定class ${className}` と**間に空白**があり、正常に拾われていた。直結していたのは `ClockCard` と `ControlOverlay` の 2 箇所だけ
- Codex がローカルの Tailwind 4.3.0 で `2xl:min-h-[28rem]` / `2xl:min-h-112` / `2xl:min-h-clock` を候補として直接渡すと全て生成されることを確認。公式 docs でも `@utility` は variant で動作する旨が明記されている
  - https://tailwindcss.com/docs/functions-and-directives
  - https://tailwindcss.com/docs/detecting-classes-in-source-files
  - https://tailwindcss.com/docs/responsive-design

## 対応

### 1. cn ユーティリティの導入

`clsx` + `tailwind-merge` による `cn` を `apps/web/src/lib/cn.ts` に新設。各クラスを独立した引数で渡すため、テンプレートリテラル直結が構造的に起きなくなる。加えて twMerge により外部 className で内部デフォルトを安全に上書きできる。

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

### 2. 直結の解消と回避策の撤去

- `ClockCard.tsx`: `cn("... 2xl:min-h-[28rem]", className)` に変更（`@utility min-h-clock` 依存をやめ arbitrary value に戻す）
- `index.css`: `@layer utilities` の `.\32 xl\:min-h-clock` 回避策を削除
- `ControlOverlay.tsx`: `cn("... sm:top-5", !visible && "pointer-events-none")` に変更

### 3. 既存結合箇所の cn 移行

`DashboardCard.tsx` / `ThemeToggle.tsx` / `FormControls.tsx`（3 箇所）も一貫性のため cn に移行。挙動は等価。

## twMerge の挙動（テストで確認）

`apps/web/src/lib/cn.test.ts` で実挙動を固定。特にカスタムカラートークンについて確認した結果:

- `cn("bg-surface", "bg-canvas")` → `"bg-canvas"`（後勝ち）
- `cn("text-ink", "text-ink-muted")` → `"text-ink-muted"`（後勝ち）
- `cn("min-h-0", "min-h-[28rem]")` → `"min-h-[28rem]"`（後勝ち）
- `cn("min-h-0", "2xl:min-h-[28rem]")` → `"min-h-0 2xl:min-h-[28rem]"`（variant 違いは両方残す）

twMerge は `bg-`/`text-`/`min-h-` 等の標準プレフィックスでカスタム値クラスも競合グループとして認識し、後勝ちでマージする。当初「twMerge はカスタムトークンを認識しないので誤マージしない（から安全）」と書きかけたが、これは誤りで、正しくは「認識して正しくマージする」。`extendTailwindMerge` の追加設定は不要。

## 教訓

- テンプレートリテラルでクラスを組むときは、固定クラスと式を直結しない。`cn(...)` または最低限スペース区切り（`固定class ${expr}`）にする
- Tailwind の「クラスが生成されない」問題に当たったら、まず scanner がそのクラス文字列をソースから抽出できる形になっているかを疑う（`@utility` やバージョン要因より先に）

## 検証

- `pnpm --filter web build` 成功。生成 CSS に `.\32 xl\:min-h-\[28rem\]{min-height:28rem}` と `sm\:top-5{...}` が含まれ、`min-h-clock` は消滅
- ブラウザ（1920×1080）で時計カードの `getComputedStyle().minHeight` が `448px`、ダッシュボード・設定モーダルとも回帰なし
- `pnpm --filter web vitest run src/lib/cn.test.ts` 6 件パス
