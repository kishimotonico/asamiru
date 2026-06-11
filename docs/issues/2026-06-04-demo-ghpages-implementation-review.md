# GitHub Pages デモ実装レビュー

対象: `worktree-demo-ghpage` の未コミット差分

## Findings

1. 発車時刻 fixture がモジュールロード時に固定される
   - `apps/web/src/mocks/handlers.ts` の `MOCK_DEPARTURES` は module top-level で `minutesLater()` を実行している。
   - React Query は発車情報を90秒間隔で refetch するが、MSW の応答は同じ `MOCK_DEPARTURES` を slice するだけなので、ページを開きっぱなしにすると「次発」が過去時刻のまま更新される。
   - デモの主画面で一番目立つ情報なので、`http.post("*/api/rail/departures", ...)` のリクエストごとに departures を組み立てるべき。

## Checked

- `pnpm --filter shared build`: pass
- `pnpm --filter web build`: pass
- `VITE_DEMO_MODE=true VITE_BASE_PATH=/asamiru/ pnpm --filter web build`: pass
- `pnpm --filter web test`: pass

## Notes

- MSW 起動を await してから render する構造、`/asamiru/mockServiceWorker.js` の参照、Actions の pnpm setup と build/deploy 分離は妥当。
- `POST /api/rail/line-status` が request body の `lines` を反映する点は、設定 UI と整合している。
- demo build の `dist/index.html` は `/asamiru/assets/...` を参照し、`dist/mockServiceWorker.js` も生成されている。
