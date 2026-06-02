# asamiru: 朝見るダッシュボード

## コンセプト

完全に自分で使うためだけのダッシュボード。Vibeに作る

部屋に置いてあるモニターに、朝起きたときに知りたいことを表示するしくみ。

## Getting Started

```
pnpm install
cp .env.example .env.local
pnpm dev
```

`pnpm dev` は API と Web を同時に起動する。

- Web: http://asa.localhost:1355 ([portless](https://github.com/vercel-labs/portless))
- API: http://asa-api.localhost:1355

今のところ、1920x1080のフルスクリーンを想定

## Production run

本番ビルドを作成して、NodeプロセスだけでWebとAPIを配信する。

```
pnpm install
cp .env.example .env.local
pnpm serve
```

`pnpm serve` は `shared`、`api`、`web` を本番ビルドしてから API サーバーを起動する。API サーバーは `apps/web/dist` も静的配信するため、ブラウザから `http://localhost:8787` を開けばダッシュボードを表示できる。

ビルド済みファイルをそのまま再起動するだけなら:

```
pnpm start
```

既定のポートは `8787`。変更する場合は `PORT=3000 pnpm start` のように指定する。Webビルド出力を別の場所から配信したい場合は `ASAMIRU_WEB_DIST=/path/to/dist pnpm start` を使う。

## 設定

`.env.local` で表示対象を設定する。

- `VITE_KEIO_BOARDING_STATION`: 京王線・京王相模原線の乗車駅名。opentidkeio の列車別時刻表に含まれる駅名と一致させる。
- `VITE_KEIO_DIRECTIONS`: `both`。現フェーズでは両方面表示。
- `VITE_WEATHER_LAT` / `VITE_WEATHER_LON`: 天気取得地点。既定例は東京。

天気はブラウザから直接取得する。次発列車と路線ごとの運行情報は `apps/api` が取得・正規化し、Web は `/api/rail/departures` と `/api/rail/line-status` を参照する。

## Monorepo

```
apps/
  web/      # Vite + React SPA
  api/      # Hono backend
packages/
  shared/   # shared types and watched train lines
```
