# worktree-front-renew マージ前レビュー

## 対象

`main` に `worktree-front-renew` を取り込む前のレビュー。

## 指摘

1. `worktree-front-renew` は `main` の `forcedSleep` 修正コミット `b1536c5` を含んでいない。
   - `main` 側では `nextScheduleWakeStartAfter` が重複・隣接する起床帯を連続帯として扱うよう修正済み。
   - マージ時は `apps/web/src/sleep/sleepSettingsAtom.ts` と `apps/web/src/sleep/sleepSchedule.test.ts` の `main` 側挙動を保持すること。

2. `ControlOverlay` は非表示時もボタンがアクセシビリティ tree に残る。
   - 見た目は `opacity: 0` だが、`Tab` 移動やスクリーンリーダーでは「ダークモードに切替」「フルスクリーン」「モニターをOFF」「設定」が届く。
   - キーボード操作時は `focus` で表示する、または非表示中は `tabIndex=-1` / `aria-hidden` / `pointer-events` を制御する必要がある。

3. `docs/frontend-design.md` のオーバーレイ仕様が最新実装とずれている。
   - ドキュメントは `opacity-35` / `hover` / `focus-within` 前提だが、実装はポインター操作後のみ表示するタイマー方式。
   - 実装方針を採用するならドキュメントを更新すること。

4. オーバーレイのアイコンが `ControlOverlay` / `ThemeToggle` にインライン SVG として重複している。
   - 今後操作ボタンが増えるなら、アイコンコンポーネントまたは icon ライブラリ導入で責務を分ける余地がある。

## 検証

- `worktree-front-renew` で `pnpm --filter web test` は成功。
- `worktree-front-renew` で `pnpm --filter web build` は成功。
- `git diff --check main..worktree-front-renew` は問題なし。
- `git merge-tree <merge-base> main worktree-front-renew` では自動マージ不能な競合は検出されなかった。
- `agent-browser` で `http://worktree-front-renew.asa.localhost:1355` を確認し、起床後の dashboard、設定モーダル、表示/システムタブ、テーマ選択の表示を確認した。
