# テスト基盤導入と毎日使う画面ロジックのテスト追加（TODO）

ステータス: 未着手（実用性優先のため保留）

## 背景

Codex のレビューで「補完ロジックのテストがない」と指摘された。調査の結果、このリポジトリには**テストフレームワークもテストも一切存在しない**。

このアプリは毎日表示するダッシュボードで、発車案内・運行情報・天気・カレンダーの表示は入り組んだ純粋ロジック（京王線の方向/種別/行先/分岐線判定、運行日の深夜帯ロールオーバー、祝日ダイヤ判定、天気コード変換など）に支えられている。これらが壊れると毎日の画面が崩れるが、現状は手動確認しか検証手段がない。

本来テストを実装すべきだが、現時点では実用性を優先し、計画のみ TODO として記録する。スクレイピング（年1回・手動）はテスト対象外。

## テスト基盤（導入時の方針）

フレームワークは vitest。コンポーネント描画テストは行わず、純粋関数・パーサー・統合（fetchモック）に絞るため `@testing-library` は導入しない。

- `apps/api` と `apps/web` にそれぞれ `vitest` を devDependency 追加。`apps/web` は `mergedStorage` の localStorage テスト用に `happy-dom` も追加
- `apps/api/vitest.config.ts`（environment: node）、`apps/web/vitest.config.ts`（environment: happy-dom）。両方 `globals: true`
- 各パッケージ `package.json` に `"test": "vitest run"`、ルート `package.json` に `"test": "pnpm -r --if-present test"`
- テストファイルは各ソース隣接の `*.test.ts`。`tsc -b` がテストを拾わないよう各 `tsconfig.json` の `exclude` に `"**/*.test.ts"` を追加し、vitest 側の型は `vitest/globals` を types に追加

共通課題: テスト対象の純粋関数の多くが**非 export**。テストのため対象関数に `export` を付与する（大規模な純粋モジュール切り出しはリグレッションリスクを避けて行わない。export 追加は最小限の妥協）。

## テスト対象（優先度順）

### フェーズ1: 発車案内の中核

`apps/api/src/departures.ts`（対象関数に export 付与）と `apps/api/src/timetable.ts`。

純粋関数のユニットテスト:
- `serviceLabel` / `destinationLabel`: コード→ラベル変換。既知コードと default（`種別${code}`/`行先${code}`/`不明`）
- `directionKey`: "0"→上り方面 / "1"→下り方面 / その他→`${dest}方面`・`方面未設定`
- `distanceBeforeBoarding`: 上り(`>=`)・下り(`<=`)の方向反転、到達不能で undefined
- `stationBranch` / `isProbablyUnreachableBranch`: 相模原線/八王子・高尾線の分岐除外。common は常に false
- `parseServiceDayTimeToMinutes` / `currentServiceDayMinutes` / `serviceDateKey`: 04:00 ロールオーバー境界（03:59 は前日扱い・+24h、04:00 は当日）
- `formatMinutes`: 24h ラップ、負値正規化（`((m%1440)+1440)%1440`）
- `parseDelay`: 空/NaN/負→0、正常値
- `parsePositionOrder`: "K001"→1、形式外→undefined
- `groupDepartures`: 方向別ソート・displayLimit 切り・遅延時のみ scheduled/delay 付与・schedule は delay 無し・source 引き継ぎ
- `collectUpcomingTrains`: traffic JSON（プレーンオブジェクト）→ TARGET_LINES(K/S) 絞り込み・距離ソート・分岐除外

`timetable.ts`:
- `selectDiakind`: 平日→weekday、土曜/日曜→holiday、祝日→holiday（`holiday_jp` は実物使用、固定日付で）
- `normalizeKey`（export 付与）: `飛田給（味の素スタジアム前）`→`飛田給`、互換漢字 `笹塚`、`つつじヶ丘`→`つつじケ丘`。**全角括弧除去が NFKC より先**である回帰の固定
- `normalizeDestination`: 【】〔〕注記の除去
- `timetableTimeToMinutes`（export 付与）: 深夜帯 +24h。departures 側の同仕様と整合
- `buildScheduleCandidates`: timetable.json を `vi.mock` で固定データに差し替え、現在時刻以降のみ・trainNo による realtime 重複排除・時刻順ソート・駅未発見で空配列

`fetchDepartures` の統合テスト（fetch をモック）:
- `global.fetch` を URL で分岐させ、`traffic_info.json` と `dia/{id}.json` の固定レスポンスを返す。`now` は引数注入で固定、`timetable.json` は `vi.mock` で固定
- 終点付近の駅でリアルタイムが不足する方向に時刻表補完が出る（source: "schedule"）
- 中間駅でリアルタイムが displayLimit を満たす方向には補完が混ざらない
- realtime と時刻表の trainNo 一致で二重表示されない
- 出力の `source` が realtime/schedule で正しく付く

### フェーズ2: 運行情報パーサーと天気

`apps/api/src/index.ts`（対象関数に export 付与）:
- `parseYahooTrainInfo`: 固定 HTML フィクスチャ（`#mdServiceStatus` 構造）を cheerio で解析。`平常運転`→level "ok"、異常時→"warn"、status と重複する備考の除外、解析不能で throw
- `normalizeYahooTransitInfoUrl`: `https://transit.yahoo.co.jp/diainfo/{数字}/{数字}` のみ許可・末尾スラッシュ除去、不正URL拒否

`apps/web/src/data/weather.ts`（対象関数に export 付与）:
- `weatherIcon` / `weatherLabel`: WMO 天気コードの範囲境界（51-67・80-82・95/96/99・霧45/48 など）。両者で範囲が異なる箇所の整合
- `normalizeWeather`: Open-Meteo 固定 JSON → 画面用構造。6時間ピック（6/9/12/15/18/21）、today インデックス探索、欠損で throw。内部 `new Date()` は `vi.useFakeTimers` で固定
- `normalizeForecastDay`: 範囲外 index で throw

### フェーズ3: カレンダーと設定の後方互換

`apps/web/src/dashboard/CalendarCard.tsx` の `buildCalendar`（export 付与）:
- 月曜始まりの先頭空白 `(getDay()+6)%7`、月の日数、月またぎ、isToday。`today` を引数注入

`apps/web/src/settings/mergedStorage.ts` の `mergedStorage`（export 済み、happy-dom）:
- localStorage 値とデフォルトのシャローマージ、空文字・JSON parse 失敗時のデフォルト返却、スキーマ追加フィールドの後方互換

## 主要ファイル（実装時）

新規:
- `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`
- `apps/api/src/departures.test.ts`, `apps/api/src/timetable.test.ts`, `apps/api/src/index.test.ts`
- `apps/web/src/data/weather.test.ts`, `apps/web/src/dashboard/calendar.test.ts`, `apps/web/src/settings/mergedStorage.test.ts`

変更（export 付与・exclude 追加）:
- `apps/api/src/departures.ts`, `apps/api/src/timetable.ts`, `apps/api/src/index.ts`
- `apps/web/src/data/weather.ts`, `apps/web/src/dashboard/CalendarCard.tsx`
- 各 `package.json`（test スクリプト・devDeps）、各 `tsconfig.json`（exclude）

## 留意点（実装時に確認）

- `timetable.ts` は `import ... with { type: "json" }`（import attributes）を使用。vitest（vite/esbuild）が解釈できるか最初に確認する。問題が出れば `vi.mock` でのJSON差し替え方式に寄せる
- `holiday_jp` は実物を使う（固定日付なので決定的）。祝日データのバージョン差異に注意
- export 追加は対象関数のみに限定し、内部実装の公開範囲を最小化する
