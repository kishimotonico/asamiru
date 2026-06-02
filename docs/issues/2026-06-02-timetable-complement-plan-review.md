# 駅別時刻表補完プランのレビュー

対象: `docs/plans/json-1-2-agile-emerson.md`

## 必須修正

### 1. 補完は `groupDepartures()` 後ではなく、最終投影前に行う

計画では `groupDepartures()` で方向別に確定した直後に補完するとしているが、現行の `groupDepartures()` は `RailDeparture` へ投影する時点で `trainId` と `scheduledMinutes` を捨てる。
さらに `scheduled` は遅延時だけ出力されるため、定刻リアルタイム列車との重複排除に必要な情報が残らない。

補完は `TrainCandidate` 相当の内部型に対して行い、`trainId` / `scheduledMinutes` / `estimatedMinutes` / `source` を持ったまま重複排除と再ソートを行う。
その後に `RailDeparture` へ変換する構造にすること。

### 2. 時刻表データの配置が build 後に壊れる

計画は `apps/api/data/timetable.json` を新規作成するとしている。
しかし現行 `apps/api/tsconfig.json` は `rootDir: "src"` かつ `include: ["src"]` なので、`apps/api/data` は `dist` に含まれない。
開発時にファイルシステムから読めても、`pnpm build` 後の `node dist/index.js` で参照パスが壊れる。

選択肢は以下のどちらかに寄せる。

- `apps/api/src/data/timetable.json` に置き、JSON import または `new URL("./data/timetable.json", import.meta.url)` で読む
- `apps/api/data` を維持するなら、build 時コピーと実行時パス解決を明示する

このプロジェクト規模なら前者が単純。

### 3. 日付付き ISO 時刻を `HH:MM` に落とす前提が深夜帯で危険

NAVITIME API の `time` は `2026-06-08T00:01:00+09:00` のような日付付き ISO で返る。
現行 departures は 04:00 未満を前日の運行日として扱う `SERVICE_DAY_ROLLOVER_MINUTES` 前提で動いている。

保存形式を `HH:MM` にする場合でも、補完側は必ず `parseServiceDayTimeToMinutes()` と同等の処理で `00:xx` を 24時台として比較する必要がある。
またダイヤ種別判定も `now` の暦日ではなく、既存の `serviceDateKey(now)` 相当の運行日で行うこと。

### 4. 京王公式駅一覧だけでは全 `station/line/direction` を列挙できない可能性が高い

京王公式の駅一覧には各駅の NAVITIME 時刻表リンクがあるが、一覧上は駅ごとに代表リンクが並ぶ形で、全方向・全路線の組み合わせがそのまま列挙されているとは限らない。
計画の「駅一覧ページから各駅×方向を抽出」は過信しないほうがよい。

実装前調査には以下を追加する。

- 駅一覧リンクから得た `station` ごとに、対象駅の全 `direction` が取得できるか
- 調布・北野・高幡不動のような分岐駅で、`line=1/3/4` の必要データが欠けないか
- `TARGET_LINES` と既存 `STATION_ORDER_BY_NAME` の対象駅だけに絞ったとき、全駅・全方向の JSON が生成されるか

## 改善推奨

### 5. 重複排除キーは `train_no` 第一でよいが正規化を明記する

実レスポンス上、NAVITIME の `train_no` と opentidkeio の `tr` は同じ体系に見える。
ただし opentidkeio 側は `" 7753 "` のように空白を含むため、比較前に `trim()` が必須。

フォールバックの「時刻 + 行先 + 種別」は、NAVITIME の行先が `京王八王子〔高幡不動から各駅停車〕` のような注記付きになるため、そのままでは一致しない。
フォールバックを使うなら、行先は注記除去後の主行先に正規化する。

### 6. 駅名正規化は `ヶ/ケ` だけでは足りない

NAVITIME は `笹塚` のような互換漢字を返す。
既存コード側は `笹塚` を使っているため、`String.prototype.normalize("NFKC")` を基礎にしつつ、`ヶ/ケ` など個別差分を足す形がよい。

### 7. 型は shared を web に直接流す

`apps/web/src/dashboard/types.ts` に `RailDeparture` 相当の構造を手書きで重複させるより、`@asamiru/shared` から `RailDeparture` を import して使うほうがよい。
今回 `source` と `delay?` を追加するなら、手書き型の追従漏れが起きやすい。

### 8. テスト計画を少しだけ増やす

既存にテスト基盤はないが、この変更は日付・重複排除・分岐にバグが出やすい。
最低限、`timetable.ts` の純粋関数として以下を単体確認できる形にしておく。

- 平日/土休日/祝日と 04:00 未満の運行日判定
- `23:xx` 現在で `00:xx` の列車を次発候補に残す
- `train_no` と `tr.trim()` による重複排除
- `笹塚` / `笹塚`、注記付き行先の正規化

## 確認した外部前提

- 京王公式の駅・時刻表ページには NAVITIME の時刻表リンクが存在する。
- NAVITIME API は `station`, `timetables[].target`, `operations[].minutes[].train_no`, `type`, `destinations`, `is_departure`, ISO時刻、`detail.revision` を返す。
- opentidkeio の `tr` は NAVITIME `train_no` と近い形式だが、空白を含む。
