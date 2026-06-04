# Tailwind v4 @utility のレスポンシブ variant 生成問題

**日付**: 2026-06-04  
**影響ファイル**: `apps/web/src/index.css`, `apps/web/src/dashboard/ClockCard.tsx`  
**解決コミット**: `00aab66`

## 背景

時計カードを 2xl ブレークポイント（≥ 1536px）で最小高さ 28rem に固定したかった。`DashboardCard` のベースに `min-h-0` があり、Tailwind の responsive utility で上書きする想定。

## 試みた方法と結果

### 1. `2xl:min-h-[28rem]`（arbitrary value）

```tsx
<DashboardCard className="... 2xl:min-h-[28rem]">
```

**結果**: CSS 生成されない。`min-height: 0px` のまま。

既存の `2xl:min-h-[calc(100vh-7rem)]` は生成されており、arbitrary value が必ず通るわけではなく、式の種類で挙動が異なる。`28rem` は単純な rem 値で `calc()` を含まないためか通らなかった（推測）。

### 2. `2xl:min-h-112`（spacing scale）

```tsx
<DashboardCard className="... 2xl:min-h-112">
```

**結果**: 同じく CSS 生成されない。`min-h-64` などは生成済みのため、スキャンには問題ないが `2xl:` variant で spacing scale が効かなかった。

### 3. `@utility` + `2xl:min-h-clock`

```css
/* index.css */
@utility min-h-clock {
  min-height: 28rem;
}
```

```tsx
<DashboardCard className="... 2xl:min-h-clock">
```

**結果**: CSS 生成されない。dev server 再起動後も同様。本番ビルドでも未生成。

### 4. `@utility` + ベースクラス両方（調査用）

```tsx
<DashboardCard className="... min-h-clock 2xl:min-h-clock">
```

**結果**: `.\32 xl\:min-h-clock { min-height: 28rem }` が**生成された**。ただし `.min-h-clock` 自体は生成されない。

## 調査で判明した Tailwind v4.3.0 の挙動

`@utility` で定義したカスタム utility に responsive variant を付けた場合、**ベースクラス名がソースファイルに存在しないと variant の CSS が生成されない**。

| ソースの class | 生成される CSS |
|---|---|
| `2xl:min-h-clock` のみ | なし |
| `min-h-clock` のみ | なし（`.min-h-clock` も生成されない） |
| `min-h-clock` + `2xl:min-h-clock` | `.\32xl\:min-h-clock` のみ生成 |

built-in utility（`2xl:self-stretch`、`2xl:text-5xl` 等）は variant 単体で問題なく生成される。`@utility` で定義したカスタム utility は variant の解決時に base class のスキャン結果を参照するようで、base が見つからないと utility 自体が未定義扱いになる模様。Tailwind v4.3.0 が最新であり、将来のバージョンで修正される可能性がある。

## 採用した解決策

```css
/* index.css */
@layer utilities {
  @media (width >= 96rem) {
    .\32 xl\:min-h-clock {
      min-height: 28rem;
    }
  }
}
```

`@layer utilities` に直接 CSS セレクターを書くことで、スキャンに依存せず確実に生成される。クラス名の CSS エスケープ（`\32 xl\:` → `2xl:`）は既存の `.\32 xl\:min-h-\[calc\(100vh-7rem\)\]` と同じ規則。本番ビルドおよび dev server の両方で `min-height: 448px` が適用されることを確認済み。

## 注意点・今後

- `@utility` + variant-only が修正された Tailwind バージョンがリリースされたら `@layer utilities` → `@utility` に戻す余地がある（ClockCard 側の `2xl:min-h-clock` クラス名はそのまま使える）
- `@media (width >= 96rem)` は Tailwind v4 の `2xl` ブレークポイント定義と一致（`--breakpoint-2xl: 96rem`）
- 今回 `1` と `2` が通らなかった正確な原因は未特定。Tailwind v4 の dev server CSS HMR が本セッション中にスタックしていた（style タグが 52149 bytes で固定）影響で「実は生成されていたが画面に反映されなかった」という可能性は否定できないが、本番ビルドでも確認したため確実に未生成だった
