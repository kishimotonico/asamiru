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

## 本番起動

Raspberry Pi など1台のデバイスで動かす想定。リバースプロキシは挟まず、API サーバー（Hono）が `apps/web/dist` も静的配信するので、Node だけで完結する。

```
pnpm build   # shared → api → web をまとめてビルド
pnpm start   # API を起動（apps/web/dist も配信）
```

起動後は http://localhost:8787 でダッシュボードを開ける。

- `PORT`: 待ち受けポート（既定 `8787`）。
- `ASAMIRU_WEB_DIST`: 配信する Web ビルドの場所を変えたいときに指定。未指定なら `apps/web/dist` を使う。

`VITE_*` はビルド時に埋め込まれる。`VITE_API_ORIGIN` を変更した場合は再ビルドが必要。

### Raspberry Pi のモニター連動

モニター連動は既定で無効。`.env.local`または実行時の環境変数で明示的に有効化する。`pnpm start`はルートの`.env.local`をAPI実行時にも読み込む。

```sh
# .env.local: ddcutil --display 1 を使う例
ASAMIRU_DISPLAY_ENABLED=true
ASAMIRU_DISPLAY_NUMBER=1

# またはシェルで一時的に指定
ASAMIRU_DISPLAY_ENABLED=true ASAMIRU_DISPLAY_NUMBER=1 pnpm start

# ddcutil --bus 10 を使う例（bus 指定を優先）
ASAMIRU_DISPLAY_ENABLED=true ASAMIRU_DDC_BUS=10 pnpm start
```

`ASAMIRU_DDC_BUS`が未指定なら`ASAMIRU_DISPLAY_NUMBER`、それも未指定なら`--display 1`を使う。起動時には、実際に選ばれた`ddcutil`対象、DRM connector、初回の接続・電源判定を標準出力へ表示する。起動後もON/OFF、接続状態、制御要求、エラーの変化を表示する。

ログはアプリ内のファイルには保存せず、標準出力・標準エラーへ出す。systemdで起動している場合は`journalctl`で確認する。

## 設定

表示対象の設定はブラウザの **localStorage**（jotai の atomWithStorage）で管理する。画面右上の歯車アイコン → 設定モーダルから変更できる。

設定可能な項目:
- 天気取得地点（緯度・経度）
- 乗車駅・監視路線・表示本数
- スリープスケジュール（開始・終了時刻）
- モニター連動の状態表示

`.env.local` に `VITE_*` を書く必要はない。dev 時に API オリジンを変えたい場合のみ `VITE_API_ORIGIN` を指定する（本番ビルドでは不要）。

天気はブラウザから Open-Meteo を直接取得する。次発列車と路線ごとの運行情報は `apps/api` が取得・正規化し、Web は **POST** `/api/rail/departures` と **POST** `/api/rail/line-status` で取得する。

## Monorepo

```
apps/
  web/      # Vite + React SPA
  api/      # Hono backend
packages/
  display-control/ # Raspberry Pi の物理モニター制御（Node 専用・オプショナル）
  shared/   # shared types and watched train lines
```
