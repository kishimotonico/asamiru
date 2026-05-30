# モックから実データ駆動ダッシュボードへ

## 背景

現状の asamiru は Vite + React 19 のクライアントサイドアプリで、`src/dashboard/data.ts` の静的な `dashboardData` を表示している。これを日時・天気・交通の3領域から実データを取得するダッシュボードへ移行する。

**サーバーは不要。** Open-Meteo・opentidkeio の両 API とも CORS 許可を確認済み（opentidkeio は Origin を echo back）。現フェーズは SPA からブラウザ直 fetch で全機能を実現する。Hono サーバー / monorepo 化は、CORS を通せないスクレイピングや秘匿キーが必要になる将来に導入する（YAGNI）。

## 方針

- 日時はデバイスのローカル時計で表示し、ネットワーク取得は行わない。
- 天気は Open-Meteo を直接 fetch し、東京の天気を表示する。
- 交通は opentidkeio の非公式 API（`docs/keio-train-status-fetch.md`）を直接 fetch し、京王線の次発列車ボードを表示する。両方面を表示。
- 乗車駅・方面は Vite env（gitignore する `.env.local`）でビルド時設定。秘匿キーは無いのでクライアントバンドルへ埋め込んで問題なし。
- Phase 1 では運行状況セクションを非表示にし、次発列車ボードに集中する。
- 取得・パース失敗時は偽データにフォールバックせず、フックの `error` state に乗せ UI で「取得失敗」を明示する。
- 次発判定は**シンプル方式**（乗車駅の定刻＋遅延 ≥ 現在時刻で各方面の最短）。位置ベース精緻化は Phase 2。
- `pnpm dev`（portless, asa.localhost:1355）はそのまま維持。Vite proxy は不要。

非公式 API の留意点（docs 準拠）:
- 仕様安定保証なし。取得/パース失敗は明示エラーとして扱う。
- `traffic_info.json` は 5秒以上の間隔を空ける（フックのポーリング 60秒で担保）。
- `dia/{trainId}.json` は候補列車を絞ってから取得、時刻表は静的なのでメモリキャッシュで再取得を避ける。

## アーキテクチャ

```
[ブラウザ(React SPA)]
  ├─ 日時:  ローカル時計で完結（fetch なし）
  ├─ 天気:  Open-Meteo を直接 fetch（10分間隔）
  └─ 交通:  opentidkeio を直接 fetch（60秒間隔 + dia メモリキャッシュ、次発計算はクライアント TS）
```

## バックエンド

不要（今フェーズはサーバーレス）。

## データ取得層（新規 `src/data/`）

### `src/data/weather.ts`

Open-Meteo Forecast API を fetch し、`DashboardData["weather"]` 形に整形する。

- エンドポイント:
  ```
  https://api.open-meteo.com/v1/forecast
    ?latitude={VITE_WEATHER_LAT}
    &longitude={VITE_WEATHER_LON}
    &timezone=Asia/Tokyo
    &hourly=temperature_2m,precipitation_probability,weather_code
    &daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max
  ```
- `models` は指定しない（既定 best_match。明示指定は仕様変更時の失敗要因、フォールバック分岐も作らない）。
- WMO `weather_code` → `WeatherIconKind`（"sun"|"cloud"|"partly"|"rain"|"snow"）と日本語ラベルへ変換するマッピング関数を実装。
- `today.hourly` は3時間おきに間引き（06/09/12/15/18/21 時台）。`tomorrow`/`dayAfter` は `daily` から。

### `src/data/trains.ts`

opentidkeio から次発列車を計算する（`docs/keio-train-status-fetch.md` のフロー準拠）。

1. `GET https://i.opentidkeio.jp/data/traffic_info.json` を取得し `TS`（駅停車中）+ `TB`（駅間走行中）を候補化。
2. 京王本線・相模原線以外（井の頭線等）を `sn`（系統）で除外。
3. 候補列車の `tr`（列車番号）をトリムして `GET https://i.opentidkeio.jp/dia/{trainId}.json` を取得。時刻表はメモリキャッシュで再取得を避ける。
4. 乗車駅名（`VITE_KEIO_BOARDING_STATION`）と一致する `sn` の行を探し `ht`（定刻発車時刻）を取得。`ht` が空なら停車しないとして除外。
5. 見込み発車時刻 ＝ `ht` ＋ `dl`（遅延分）。
6. 見込み発車時刻 ≥ 現在時刻の列車だけ残し、方面（`ki`）ごとに最短のものを抽出。
7. 種別は `sy_tr`（なければ `sy`）をコード表で変換、行先は `ik_tr`（なければ `ik`）を変換。
8. 出力を `departures: Record<方面ラベル, Array<{time, scheduled?, kind, dest, delay}>>` へ整形。

種別コード表（暫定、実レスポンス観察で確認）:
- 1: 特急 / 2: 急行 / 3: 快速 / 4: 準特急 / 5: 区間急行 / 6: 各駅停車 / 9: 京王ライナー / 10: 臨時 / 11: Mt.TAKAO号

方面ラベルは `ki`（進行方向コード）を実レスポンス観察で確認してから確定。`VITE_KEIO_DIRECTIONS=both` のとき上り/下り両方を返す。

## フロントエンド実装

- `src/dashboard/useDashboardData.ts`（新規）: `useWeather` / `useTrains` を束ねたフック。ポーリング（交通 60秒・天気 10分）。`{data, error, loading}` を返す。fetch 失敗・非 200・JSON 例外を `error` に分類してメッセージ化。
- `src/dashboard/ClockCard.tsx`（改修）: 静的時刻 props への依存をやめ、内部 `setInterval`(1秒) でローカル日時・曜日を生成。`showSeconds` は既存実装を活かす。祝日は Phase 2。
- `src/dashboard/WeatherCard.tsx`（改修）: `loading`/`error` 状態を受け取り「取得失敗」を明示表示。
- `src/dashboard/TrainsCard.tsx`（改修）: 両方面の `departures` を表示。Phase 1 では **運行状況（`lines`）セクションを非表示**。`loading`/`error` で「取得失敗」明示。
- `src/App.tsx`（改修）: `dashboardData` の直読みをやめ、フックから得た天気・交通データを渡す。Clock は内部自走。
- `src/dashboard/scheduleData.ts`（新規）: `dashboardData` 廃止に伴い、静的な予定データをここへ切り出す。`ScheduleCard` はここから読む。
- `src/dashboard/data.ts`（縮小 or 削除）: schedule データを `scheduleData.ts` へ移してから整理。
- `ScheduleCard` は今回スコープ外。読み込み元の変更のみ。

## 設定（`.env.local`・gitignore）

| 変数 | 用途 | 既定 |
|---|---|---|
| `VITE_KEIO_BOARDING_STATION` | 乗車駅名（dia の `sn` と一致させる） | 必須、`.env.local` に設定 |
| `VITE_KEIO_DIRECTIONS` | 表示方面 | `both`（上り/下り両方） |
| `VITE_WEATHER_LAT` | 天気取得の緯度 | `35.6895`（東京） |
| `VITE_WEATHER_LON` | 天気取得の経度 | `139.6917`（東京） |

- `.env.local` は Vite の慣習では gitignore 対象にするが、このリポジトリの `.gitignore` には未記載のため追記する。
- `.env.example` を用意してコミットする。

## ビルド・起動

既存の `package.json` scripts は変更なし（`dev` / `build` / `preview` のみ）。新規 `start` スクリプトは今フェーズ不要。

`vite.config.ts` も変更なし（proxy 不要）。

## 変更・新規ファイル

- 新規: `src/data/weather.ts`, `src/data/trains.ts`, `src/dashboard/useDashboardData.ts`, `src/dashboard/scheduleData.ts`, `.env.example`
- 改修: `src/App.tsx`, `src/dashboard/ClockCard.tsx`, `src/dashboard/WeatherCard.tsx`, `src/dashboard/TrainsCard.tsx`, `src/dashboard/data.ts`（縮小）, `.gitignore`, `README.md`
- 据え置き: `src/dashboard/ScheduleCard.tsx`（読み元のみ変更）, `src/dashboard/Dashboard.tsx`, `src/dashboard/types.ts`

## 検証

- `.env.local` に乗車駅・方面を設定 → `pnpm dev` → `http://asa.localhost:1355/` を agent-browser で確認。
- 時計が1秒ごとに更新され、デバイスの現在時刻と一致することを確認。
- 天気カードに Open-Meteo の東京の実気温・予報が表示されることを確認。
- 交通カードに乗車駅の次発列車が両方面表示されることを確認。京王アプリ/公式と突き合わせ。
- 遅延列車が定刻取り消し線＋「+N分」で表示されることを確認。
- 外部 API 取得失敗時に「取得失敗」が表示され、偽データが表示されないことを確認。
- `pnpm build` が成功し、バンドルに env 変数が埋め込まれることを確認。
- `VITE_KEIO_BOARDING_STATION` を変えると次発の基準駅が切り替わることを確認。

## Phase 2 候補

- 運行状況セクション（京王に限らない複数路線 → CORS 不可なら Hono + monorepo 導入）
- 祝日判定
- `ScheduleCard` の実データ化
- 次発判定の位置ベース除外精緻化
- サーバーが必要になったタイミングでの monorepo 化・Hono 導入 ADR 化

## 参考

- opentidkeio API 仕様: `docs/keio-train-status-fetch.md`（非公式、安定保証なし。CORS 許可確認済み）
- Open-Meteo: https://open-meteo.com/
- `.env.local` は Vite 慣習で gitignore 対象にする。このリポジトリでは `.gitignore` へ追記が必要。

## 実装メモ

2026-05-30 Codex:

- Hono / サーバー / proxy は導入せず、SPA から Open-Meteo と opentidkeio を直接 fetch する構成で実装。
- `src/data/weather.ts` を追加し、Open-Meteo の hourly/daily を既存 WeatherCard の形へ整形。
- `src/data/trains.ts` を追加し、`traffic_info.json` と `dia/{trainId}.json` から乗車駅の次発を算出。Phase 1 は `ki` による上り/下り2方面表示、次発判定は `ht + dl >= 現在時刻` のシンプル方式。
- React dev の二重実行で同じ opentidkeio リクエストが重複しないよう、traffic と dia にメモリキャッシュおよび in-flight キャッシュを追加。
- `ClockCard` はローカル時計で自走するよう変更。
- `WeatherCard` / `TrainsCard` は `loading` / `error` を明示表示し、失敗時にモックデータを出さないよう変更。
- `ScheduleCard` 用の静的予定は `src/dashboard/scheduleData.ts` に分離。
- `.env.example` を追加し、`.env.local` を `.gitignore` に追加。

確認:

- `pnpm build`
- `pnpm dev` で起動し、agent-browser で実画面を確認。
- Open-Meteo と opentidkeio へのブラウザ直 fetch が発生し、天気・交通が実データで表示されることを確認。
- 交通カードは `調布` 駅設定で上り/下りの2方面にまとまって表示されることを確認。

2026-05-30 Codex 追記:

- 交通情報がエラーになるケースと初回 `dia/{trainId}.json` のリクエスト数が多い問題を修正。
- `traffic_info.json` の位置 ID と乗車駅の駅順を使い、乗車駅にこれから到達する列車だけを `dia` 取得候補にするよう変更。
- 各方面で表示本数（3本）が揃った時点で `dia` 取得を打ち切るよう変更。
- `traffic_info.json` の TTL / ポーリング間隔を 90秒へ延長。`dia` は 12時間キャッシュ。
- React StrictMode の effect 再実行で Open-Meteo が重複しないよう、天気にも TTL キャッシュと in-flight キャッシュを追加。
- 個別 `dia` 取得失敗は、その列車だけ除外する。全候補が失敗した場合のみ交通カード全体をエラーにする。

確認:

- `pnpm build`

2026-05-30 Codex 追記:

- 路線ごとの運行情報を追加するため、frontend-only 構成から pnpm workspace monorepo へ移行。
- `apps/web` に既存 Vite + React SPA を移動。
- `apps/api` に Hono backend を追加し、`GET /api/health` と `GET /api/train-status` を実装。
- `packages/shared` に運行情報の共有型と監視対象路線設定を追加。
- 監視対象は京王線・中央線・総武線・多摩モノレール
- API は Yahoo!路線情報のHTMLを Cheerio でparseし、2分TTLのメモリキャッシュで取得頻度を制御する。
- Web は Vite proxy 経由で `/api/train-status` を取得し、交通カードに「路線運行情報」を表示する。
- `.env.local` は引き続きroot配置で読めるよう、`apps/web/vite.config.ts` に `envDir: "../.."` を設定。

確認:

- `pnpm approve-builds esbuild`
- `pnpm build`
- `pnpm dev` で API と Web を portless 経由で起動。
- `http://asa-api.localhost:1355/api/health` と `http://asa-api.localhost:1355/api/train-status`
- `http://asa.localhost:1355` を agent-browser で開き、路線運行情報の表示を確認。
- `asa` の stale registration には触らず、別名 `asa-check.localhost:1355` で agent-browser 確認。
- `調布` 駅設定で交通カードがエラーにならず、上り/下り各3本を表示。
- 初回外部 API リクエストは Open-Meteo 1件、`traffic_info.json` 1件、`dia` 6件の計8件まで低減したことを確認。

2026-05-30 Codex 追記:

- 自前の `useEffect` polling / `AsyncState` 実装を TanStack Query v5 ベースへ移行。
- `QueryClientProvider` を追加し、天気・交通は `useSuspenseQuery` + カード単位の `Suspense` / error boundary で読み込む構成に変更。
- 初回ロードは各カードの loading fallback を表示し、初回失敗時だけカード単位で「取得失敗」+「再試行」を表示する。
- 取得済みデータがある状態でバックグラウンド更新に失敗してもカード全体をエラー画面へ差し替えず、既存データを維持して「前回更新失敗」を表示する方針へ変更。
- TanStack Query が cache / in-flight dedupe / polling を担当するため、天気と traffic のモジュールスコープ TTL cache は削除。列車別 `dia` は同一列車IDをまたぐ再利用価値があるため 12時間 cache を維持。
- Open-Meteo / opentidkeio の fetch に `AbortSignal` を渡し、Query のキャンセルと連動するよう変更。

確認:

- `pnpm build`
- 既存の `asa.localhost:1355` dev server を agent-browser で確認。
- 天気・交通・予定が表示され、初回リクエストで TanStack Query 経由の Open-Meteo / opentidkeio fetch が発火することを確認。

2026-05-30 Codex 追記:

- 互換用に残っていた query result 変換 hook を削除し、`useSuspenseQuery` の戻り値をカード接続部で直接扱う構成へ整理。
- 自前 class error boundary を削除し、`react-error-boundary` + `QueryErrorResetBoundary` の構成へ変更。
- 列車別 `dia/{trainId}.json` の自前 `Map` cache / in-flight dedupe を削除し、`queryClient.fetchQuery` と `["keio", "dia", trainId]` query key で TanStack Query cache に統一。
- 中断チェックは独自 `DOMException` 生成をやめ、標準の `AbortSignal.throwIfAborted()` に変更。

確認:

- `pnpm build`
