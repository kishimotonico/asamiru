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

http://asa.localhost:1355 ([portless](https://github.com/vercel-labs/portless)) にアクセスすると、ダッシュボードが表示される。

今のところ、1920x1080のフルスクリーンを想定

## 設定

`.env.local` で表示対象を設定する。

- `VITE_KEIO_BOARDING_STATION`: 京王線・京王相模原線の乗車駅名。opentidkeio の列車別時刻表に含まれる駅名と一致させる。
- `VITE_KEIO_DIRECTIONS`: `both`。現フェーズでは両方面表示。
- `VITE_WEATHER_LAT` / `VITE_WEATHER_LON`: 天気取得地点。既定例は東京。

天気は Open-Meteo、交通は opentidkeio をブラウザから直接取得する。サーバーや proxy は使わない。
