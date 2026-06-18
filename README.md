# asamiru

朝に見たいことをまとめて表示するダッシュボード

**demo**: https://kishimotonico.github.io/asamiru/

## 機能

- 時刻 — 大きな時計とスリープ状態
- 天気 — 指定地点の現在と予報（Open-Meteo）
- 次発列車と運行情報 — 乗車駅・路線ごとに表示
- カレンダー予定 — ICS フィードから直近の予定

1920x1080 のフルスクリーンで見る前提で組んでいる。表示対象は画面右上の歯車アイコンから設定でき、ブラウザの localStorage に保存される。

## 開発

```sh
pnpm install
cp .env.example .env.local
pnpm dev          # → http://asa.localhost:1355
```

## 本番

APIサーバー（Hono）がビルド済みクライアントも配信するため、Node.js だけで起動できる。

```sh
pnpm build
pnpm start        # → http://localhost:8787
```

ディスプレイ連動機能（asamiruのスリープに合わせてディスプレイを ON/OFF したり、ディスプレイの ON/OFF に合わせてasamiruをスリープしたりする機能）はデフォルトで無効なので、使うときは環境変数で有効化する。主にRaspberry Piで常時稼働するときの利用を想定。

```sh
ASAMIRU_DISPLAY_ENABLED=true pnpm start
```

## 構成

pnpm workspace のモノレポ。

```
apps/web   Vite + React SPA（ダッシュボード本体）
apps/api   Hono backend（鉄道情報・カレンダーの取得・正規化、モニター制御、静的配信）
packages/  共有の型・路線マスタ、Raspberry Pi のモニター制御
```

設計は [ARCHITECTURE.md](./ARCHITECTURE.md) や [ADR](./docs/adr) を参照。
