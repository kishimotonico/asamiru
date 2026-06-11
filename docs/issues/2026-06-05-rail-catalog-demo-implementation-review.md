# 鉄道カタログ層デモ差し替え実装レビュー

対象: `worktree-demo-ghpage` `bb188cf`

## Findings

1. デモ運行情報の `sourceUrl` が全行 `#` で React key が重複する
   - `apps/web/src/demo/railDemoData.ts:122` で `buildDemoLineStatus()` が全ての行に `sourceUrl: "#"` を返している。
   - `apps/web/src/dashboard/TrainsCard.tsx:122` と `apps/web/src/dashboard/TrainsCard.tsx:136` は `line.sourceUrl` を React key に使う。
   - デモ既定値では OK 路線が複数あるため、`okLines.map()` の key が重複し、React の key warning と再描画時の不安定さが発生する。
   - `sourceUrl` は表示されていないので、`watched.yahooUrl` を入れるのが最小修正。`demo:*` でも key としては十分一意。

## Non-Issues

- デモ時にカスタム路線追加 UI が残る点は、既存 UI をデモのために変えない方針として扱う。今回のレビュー指摘からは外す。
- Vite plugin による `catalog/active` 差し替えは、実際に本番・デモ両方の build が通っている。

## Checked

- `pnpm --filter shared build`: pass
- `pnpm --filter web build`: pass
- `VITE_DEMO_MODE=true VITE_BASE_PATH=/asamiru/ pnpm --filter web build`: pass
- `pnpm --filter web test`: pass
- 本番ビルドで demo catalog の駅・路線識別子は混入していない。ただし `railKind.ts` の `きさらぎライナー` は別経路で本番 bundle に残る。
- デモビルドで本番 rail catalog は混入していない。`東京` / `京王線` などは天気既定値や loading 表示など catalog 外の既存文字列として残る。
