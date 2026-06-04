# 鉄道カタログ層デモ差し替えプランレビュー

対象: `~/.config/claude/plans/ok-serialized-wozniak.md`

## Findings

1. 設定保存値のモード間汚染が未設計
   - `trainsSettingsAtom` は本番・デモで同じ `asamiru-trains-settings` localStorage key を使っている。
   - 既に本番設定が保存されているブラウザでデモを開くと、`mergedStorage` が demo defaults より保存値を優先し、実在駅・実在路線がデモに混入する可能性がある。
   - カタログ差し替えの目的は「完全一貫」なので、デモ専用 storage key に分けるか、復元時に現在の `RAIL_CATALOG` に照らして設定値を正規化する設計が必要。

2. line-status の request body 名が実コードと不一致
   - 計画は `buildDemoLineStatus(requested: WatchedLine[])` を `watchedLines` から呼ぶ想定だが、`apps/web/src/data/lineStatus.ts` は `{ lines }` を POST している。
   - このままだと handler 側が `watchedLines` を読んでも空扱いになり、設定変更の反映という主目的を外す。
   - API と同じ契約で `{ lines }` を読むよう明記すべき。

3. dead-code-elimination 前提が強すぎる
   - `index.ts` が production/demo の両 catalog を static import した上で env 三項分岐する設計は、Rollup の定数畳み込みと tree-shaking に依存する。
   - 「本番バンドルにデモデータが載らない」「デモバンドルに本番マスタが載らない」は検証項目にはあるが、設計保証としては弱い。
   - バンドル分離を本質要件にするなら、Vite alias などで `./catalog/active` を `catalog.demo.ts` / `catalog.production.ts` に解決する方式の方が明確。

4. `demo:` URL とカスタム路線 UI の整合が甘い
   - デモカタログの `yahooUrl` に `demo:*` を使うのは識別子としては妥当。
   - ただし同じ画面に Yahoo URL 形式専用のカスタム路線追加 UI が残るため、デモの世界観と入力ルールが混ざる。
   - デモでカスタム路線を使わせない、またはデモ用識別子を追加できる UI に切り替える、など UX 上の方針を決めるべき。

5. カタログ型が「選択肢」と「デモ応答生成」を十分に結んでいない
   - `RailCatalog` は settings UI の選択肢と defaults だけを持ち、MSW が使う status/note/line identity は別の内部 catalog に分かれる。
   - 単一の真実源を目標にするなら、`DEMO_LINES` と `DEMO_LINE_CATALOG` の対応が崩れない構造にする必要がある。
   - 例えば demo catalog の line item を status metadata 付きで定義し、設定選択肢用の `WatchedLine[]` はそこから派生させる方が事故が少ない。

## Notes

- `packages/shared` を本番ドメインのままにし、web 内に demo/catalog 層を置く方針は妥当。
- 設定 UI と MSW handler が同じ架空データを参照する方向性も妥当。
- `BOARDING_STATIONS` へのリネームは実態に合っており、破壊的変更 OK の方針とも整合する。

## Final Review

更新後の計画では、主要な設計リスクは実装方針に反映済み。

- localStorage はデモ専用 key で分離する方針になり、モード間汚染の懸念は解消。
- line-status は実 API クライアントと同じ `{ lines }` 契約を読むことが明記され、設定反映の主目的に合っている。
- デモ時のカスタム路線追加 UI 非表示により、`demo:*` 識別子と Yahoo URL 入力ルールの混在は避けられる。
- DCE 依存は残るが、今回は「まずはやってみる」方針で許容可能。検証で漏れたら alias 方式に切り替える扱いで十分。

結論: 計画段階のブロッカーはなし。この内容で実装に進んでよい。細かい型境界、import 循環、実際のバンドル混入有無、UI 表示条件は実装後レビューで確認する。
