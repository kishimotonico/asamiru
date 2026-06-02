# 駅別時刻表データによる発車案内の補完

## Context

現状の発車案内（`apps/api/src/departures.ts` の `fetchDepartures()`）は、opentidkeio の `traffic_info.json`（走行中の列車位置）と `dia/{trainId}.json`（列車別時刻表）だけを使い、「今まさに走っている列車」から次発を計算している。

このため**下り終点付近の駅（橋本・京王八王子・高尾山口など）では、乗車駅へ向かう上り列車がまだ手前を走っておらず `traffic_info.json` に現れない**ため、上り方面の表示本数が `displayCount` に届かず欠ける欠点がある。

これを補うため、駅別の静的時刻表データ（年1回のダイヤ改正時にスクレイピング取得）を保持し、リアルタイムで取得できた本数が不足する方向について、時刻表上の「これから来るはずの定刻列車」を補完する。リアルタイム情報を主、時刻表を従とすることで、運休・行先変更・遅延の反映を損なわずに表示欠けだけを解消する。

## 決定事項（ユーザー確認済み）

- 補完の発動: **不足時のみ**（方向ごとにリアルタイム本数 < `displayCount` のときだけ時刻表で埋める）
- UI区別: 時刻表由来とリアルタイム由来を**区別して表示**。リアルタイムの場合は遅延状態（±0＝定刻など）を示す。具体デザインは実装時に裁量。
- ダイヤ判定: **祝日ライブラリで平日/土休日を正確判定**
- 配置: **`apps/api` 配下**（後述の理由で `src/data/`）
- データソース: **navitime の裏 JSON API**

## 方針メモ（Codexレビュー反映後）

- 年1回未満の手動スクレイピングが前提のため、リトライ・自動再取得・本番フォールバック等の冗長な仕組みは作らない。エラーは握りつぶさず素直に失敗させる。
- 重複排除は `train_no` 一本に絞る（曖昧な「時刻＋行先＋種別」フォールバックは設けない）。`train_no` と opentidkeio `tr` の同一性が事前調査で確認できることを前提とし、確認できなければ設計を見直す。
- テストコードは追加しない。ただし補完・正規化・運行日判定は **副作用のない純粋関数**として `timetable.ts` に切り出し、ロジックの透明性を担保する。

## データソースとスクレイピング

### ソース

京王公式が利用している navitime の JSON API を直接取得する（HTMLパース不要、最も堅牢）。

```
GET https://transfer-train.navitime.biz/api/keio/timetable/{station}/{line}/{direction}?lang=ja
```

- `station`: navitime独自の駅ID（連番ではない）
- `line`: `1`=京王線 / `3`=相模原線 / `4`=高尾線（`7`=井の頭線は本アプリ対象外）
- `direction`: `0` / `1`
- 1リクエストで平日(`weekday`)・土休日(`holiday`)の両ダイヤ＋ダイヤ改正日が返る
- 各列車に `type`(種別フル名)・`destinations[].name`(行先フル名)・`train_no`・`is_departure`・`time`(日付付きISO8601) が含まれる

駅×方向の `station/line/direction` の起点は、京王公式の静的駅一覧ページ `https://www.keio.co.jp/train/station/`（JS不要）に並ぶ navitime リンクから抽出する。

### 取得スクリプト

新規 `apps/api/scripts/scrape-timetable.ts`（手動・年1回未満の実行を想定）。

1. `https://www.keio.co.jp/train/station/` を取得し、cheerio（既存依存）で navitime リンクから `station/line/direction` を抽出
2. 各組を API URL に変換して JSON 取得（低頻度・適切な User-Agent・取得間隔を空ける）
3. 後述のデータ構造に正規化して `apps/api/src/data/timetable.json` へ出力（生成物はコミットして変更履歴を残す）

`apps/api/package.json` にスクリプト（例 `scrape:timetable`）を追加。

### スクレイピング前の追加調査（安価なSonnetエージェントに依頼）

実装着手前に、実APIレスポンスで以下を確認する（Codexレビュー後、実装フェーズの最初に Sonnet エージェントへ）:

- `direction` の `0/1` が上り（新宿方面）/下りのどちらに対応するか（既存 `ki` の `0`=上り/`1`=下りと突き合わせ）
- `train_no` が opentidkeio の `tr`（列車番号、`" 7753 "` のように前後空白を含む）と**同一体系**か。重複排除のキーに使えるか
- 種別フル名（`各駅停車`/`区間急行` 等）が既存 `serviceLabel()` の出力と一致するか
- 駅名・行先名の表記揺れ（互換漢字・`ヶ`/`ケ`、`京王八王子〔高幡不動から各駅停車〕` のような注記）と既存駅名キーとの整合
- **網羅性**: 駅一覧リンクから全 `direction`・全 `line` が得られるか。調布・北野・高幡不動などの分岐駅で `line=1/3/4` の必要データが欠けないか。`STATION_ORDER_BY_NAME` の対象駅すべてについて全方向のJSONが生成できるか

## データ構造

`apps/api/src/data/timetable.json`（`src` 配下に置く理由は下記）。方向キーは既存の `directionKey()`（`上り方面`/`下り方面`）に揃える。

```jsonc
{
  "generatedAt": "2026-06-02T12:00:00+09:00",
  "revision": { "weekday": "2025-03-15", "holiday": "2025-03-15" },
  "stations": {
    "京王多摩センター": {
      "上り方面": {
        "weekday": [
          { "time": "05:08", "kind": "区間急行", "dest": "新宿", "trainNo": "4700", "isDeparture": false }
        ],
        "holiday": []
      },
      "下り方面": { "weekday": [], "holiday": [] }
    }
  }
}
```

- `time` は定刻 `HH:MM`（navitime の ISO 時刻から時刻部分を抽出）。深夜帯（`00:xx`）も `HH:MM` のまま保存し、読み込み時に運行日換算する（後述）
- `dest` は注記を除去した主行先に正規化して保存
- `trainNo` は前後空白を除去（`trim()`）して保存。重複排除キー

### 配置を `src/data/` にする理由

`apps/api/tsconfig.json` は `rootDir: "src"` / `include: ["src"]` のため、`apps/api/data/` は `dist` に出力されず、`pnpm build` 後の `node dist/index.js` でパスが壊れる。`src/data/timetable.json` に置き、`import timetable from "./data/timetable.json"`（resolveJsonModule）で読む。build時コピーや実行時パス解決を増やさずに済む。

## 補完ロジック

新規 `apps/api/src/timetable.ts` に集約し、`departures.ts` から呼ぶ。すべて純粋関数で構成する。

### 重要: 補完は内部候補型に対して行う

現行の `groupDepartures()`（`departures.ts:506`）は `RailDeparture` へ投影する時点で `trainId` と `scheduledMinutes` を捨て、`scheduled` も遅延時しか残さない。このため重複排除・運行日比較に必要な情報が `RailDeparture` 段階では失われる。

したがって補完は `TrainCandidate`（`departures.ts:34`、`trainId`/`scheduledMinutes`/`estimatedMinutes` を保持）相当の内部型レベルで行い、**最後に `RailDeparture` へ投影する**構造にする:

1. `collectUpcomingTrains()` → `resolveStopInfo()` でリアルタイム候補（`TrainCandidate[]`、方向別）を確定する（既存処理）
2. 方向ごとにリアルタイム候補数が `displayLimit` 未満なら、その方向・当日ダイヤの時刻表列車を「時刻表候補」（`source: "schedule"` を持つ候補）として生成
3. リアルタイム候補に含まれる `trainId`（`tr.trim()` 正規化）と一致する時刻表候補を除外（重複排除）
4. 不足分だけ時刻表候補を `estimatedMinutes`（時刻表は定刻なので `scheduledMinutes` と同値）昇順に追加し、`displayLimit` まで埋める
5. 方向内を発車時刻順に再ソートし、最後に `RailDeparture`（`source` 付き）へ投影

リアルタイム候補には投影時に `source: "realtime"` を付与する。

### ダイヤ選択と運行日・深夜帯の扱い

`@holiday-jp/holiday_jp`（依存追加）を使い、**暦日ではなく既存の運行日**で判定する:

- ダイヤ種別は `serviceDateKey(now)`（`departures.ts:632`、04:00未満は前日扱い）が指す運行日に対して、土曜・日曜・祝日なら `holiday`、それ以外は `weekday`
- 時刻表 `time` の分換算は既存 `parseServiceDayTimeToMinutes()`（`departures.ts:542`、`SERVICE_DAY_ROLLOVER_MINUTES`=04:00 未満を +24h）と同等に行い、`23:xx` 現在に `00:xx` の列車を次発候補として正しく残す

これにより既存リアルタイム計算と時刻軸・運行日が完全に一致する。

### 重複排除

`trainNo`（時刻表側、保存時 trim 済み）== `trainId`（リアルタイム側 `tr`、比較前に `trim()`）で一致するものを同一列車とみなして除外。曖昧マッチのフォールバックは設けない。`train_no`＝`tr` の同一性は事前調査の前提とし、不成立なら本設計を見直す。

### 駅名・行先の正規化

既存駅名キー（日本語文字列、互換漢字 `笹塚` など）と時刻表の駅名・行先を突き合わせるため、`String.prototype.normalize("NFKC")` を基礎に、`ヶ`/`ケ` など NFKC で吸収できない個別差分を加えた正規化ヘルパを `timetable.ts` に用意し、駅名キー・`dest` の双方に適用する。行先の注記（`〔…〕`）はスクレイプ時に除去しておく。

## 型とUIの変更

### 共有型（`packages/shared/src/index.ts`）

`RailDeparture` にデータソースを追加。時刻表由来は遅延が未定義になるため `delay` を任意化:

```ts
export type RailDeparture = {
  time: string;
  scheduled?: string;
  kind: string;
  dest: string;
  delay?: number;              // schedule 由来では未定義
  source: "realtime" | "schedule";
};
```

### フロント（`apps/web/src/dashboard/types.ts`, `cards/TrainsCard.tsx`）

- `DashboardData["trains"]` は手書き型をやめ、`@asamiru/shared` の `RailDeparture` を import して使う（`source`/`delay?` 追加時の追従漏れを防ぐ）
- `TrainsCard` で `source` により表示を分岐:
  - `schedule`: 「時刻表」由来であることを示すバッジ（遅延非表示）
  - `realtime`: 従来通り遅延を表示。`delay === 0` のときは定刻（±0）であることを明示
- 具体的なバッジ・配色のデザインは実装時に裁量

## 変更・新規ファイル一覧

- 新規 `apps/api/scripts/scrape-timetable.ts` — 取得スクリプト
- 新規 `apps/api/src/data/timetable.json` — 生成物（コミット）
- 新規 `apps/api/src/timetable.ts` — JSON読込・ダイヤ選択・補完・正規化（純粋関数）
- 変更 `apps/api/src/departures.ts` — リアルタイム候補確定後・投影前に補完を呼ぶ、`source` 付与
- 変更 `packages/shared/src/index.ts` — `RailDeparture` に `source`、`delay` 任意化
- 変更 `apps/web/src/dashboard/types.ts` — shared の `RailDeparture` を import に置換
- 変更 `apps/web/src/dashboard/cards/TrainsCard.tsx` — バッジ・定刻表示
- 変更 `apps/api/package.json` — `@holiday-jp/holiday_jp` 追加、`scrape:timetable` スクリプト追加

## 検証

1. スクリプト単体: 数駅で `scrape:timetable` を実行し、`timetable.json` が想定構造（平日/土休日・両方向・改正日・注記除去済み行先・trim済み trainNo）で出力されることを確認
2. 補完ロジック: 終点付近の駅（橋本・京王八王子・高尾山口）を `boardingStation` に設定し、agent-browser で http://asa.localhost:1355 を開いて上り方面が `displayCount` まで埋まること、補完列車にバッジが付くことを確認
3. 重複しないこと: 中間駅（明大前など）でリアルタイムが十分な方向に時刻表列車が混ざらないこと、`trainNo`/`tr` 一致で同一列車が二重表示されないことを確認
4. 深夜帯: `23:xx`〜`00:xx` の時間帯で `00:xx` 発の列車が次発に残ることを確認（必要なら `serviceDateKey` を固定して目視）

## オープン事項（実装時に確定）

- `direction` 0/1 の上下対応、`train_no`＝`tr` の同一性、種別ラベル・駅名/行先表記の整合、駅一覧からの全駅・全方向の網羅性（いずれもスクレイピング前調査で確定）
