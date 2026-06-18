# デバッグオーバーレイ開閉のレビュー対応

## 対応内容

- `DebugOverlay` の controlled/uncontrolled 両対応をやめ、`open` / `onOpenChange` 必須の controlled コンポーネントへ整理した。
- `setState` updater 内で `onOpenChange` を呼ぶ副作用を削除し、StrictMode での二重発火リスクをなくした。
- `open` / `onOpenChange` は ref 経由で参照し、`@` キーのトグル時に keydown リスナーが再登録されないようにした。

## 確認

- `pnpm --filter web build`
- `pnpm exec eslint apps/web/src/App.tsx apps/web/src/controls/ControlOverlay.tsx apps/web/src/debug/DebugOverlay.tsx`
- agent-browser で右上デバッグボタンの開閉、`@` キーでの開閉を確認。
