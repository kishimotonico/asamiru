# Nodeのみでのproduction起動

## 背景

Raspberry Pi 4 Model B上で、DockerやCaddy/nginxを必須にせず、このプロジェクトだけを簡単に起動できる形を用意する。

このダッシュボードは1デバイスで表示する用途のため、まずは複数アプリ運用やリバースプロキシ前提の構成よりも、`pnpm` と Node.js だけで動く本番相当の起動方法を優先する。

## 方針

- `pnpm build` で `apps/web/dist` と `apps/api/dist` を生成する
- Hono APIサーバーが `apps/web/dist` も静的配信する
- `/api/*` は従来通りAPIとして処理する
- その他のGETアクセスはSPA fallbackとして `index.html` を返す
- rootの `pnpm serve` で build + start をまとめて実行できるようにする
- ビルド済み成果物を再利用する再起動は `pnpm start` とする

## 実装メモ

- `apps/api/src/index.ts` に `@hono/node-server/serve-static` を追加
- `ASAMIRU_WEB_DIST` が指定された場合はそのパスを静的配信ルートにする
- 未指定時は実行cwdに応じて `../web/dist` または `apps/web/dist` を探索する
- `apps/web/src/vite-env.d.ts` に `VITE_API_ORIGIN` を追加
- `package.json` に `start` と `serve` を追加
- `README.md` にProduction run手順を追加

## 次の確認

- Raspberry Pi上で `pnpm install --prod=false` 後に `pnpm serve` が通ること
- `http://<pi-host>:8787/api/health` が `{ "ok": true }` を返すこと
- `http://<pi-host>:8787` でダッシュボードが表示されること
- systemd service化する場合は `pnpm start` を `ExecStart` にする
