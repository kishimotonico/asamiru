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

## 設定

`.env.local` で表示対象を設定する。

- `VITE_KEIO_BOARDING_STATION`: 京王線・京王相模原線の乗車駅名。opentidkeio の列車別時刻表に含まれる駅名と一致させる。
- `VITE_KEIO_DIRECTIONS`: `both`。現フェーズでは両方面表示。
- `VITE_WEATHER_LAT` / `VITE_WEATHER_LON`: 天気取得地点。既定例は東京。

天気と次発列車はブラウザから直接取得する。路線ごとの運行情報は `apps/api` が Yahoo!路線情報を低頻度で取得・正規化し、Web は `/api/train-status` を参照する。

## Monorepo

```
apps/
  web/      # Vite + React SPA
  api/      # Hono backend
packages/
  shared/   # shared types and watched train lines
```
