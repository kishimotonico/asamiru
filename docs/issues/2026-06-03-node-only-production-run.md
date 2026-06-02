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

- Raspberry Pi上で `pnpm install --prod=false` 後に `pnpm build && pnpm start` が通ること
- `http://<pi-host>:8787/api/health` が `{ "ok": true }` を返すこと
- `http://<pi-host>:8787` でダッシュボードが表示されること
- systemd service化する場合は `pnpm start` を `ExecStart` にする

## レビュー後の調整（同日）

初版の実装をレビューし、シンプルさを優先して以下を調整した。

- `pnpm serve`（build + start を1コマンド）は削除。本番でビルドと起動を同時に行う場面は稀で、必要なら `pnpm build` → `pnpm start` の2コマンドで足りる。
- web dist の探索を `process.cwd()` 依存の2候補探索（`../web/dist` / `apps/web/dist`）から、`import.meta.url` 基準の解決に変更。実行時の cwd に依存しなくなり、systemd など任意のディレクトリから起動しても `apps/web/dist` を正しく配信できる。`ASAMIRU_WEB_DIST` 指定時は絶対パスをそのまま root に渡す（`@hono/node-server` の serveStatic は `join(root, path)` のため絶対パスで問題なし）。
- `apps/web/vite.config.ts` の dev proxy（`/api` → `VITE_API_ORIGIN`）を削除。web 側は常に `apiEndpoint()` 経由で絶対オリジンを直叩き（dev は `VITE_API_ORIGIN` + CORS、本番は同一オリジンの相対パス）しており、相対 `/api` を使う箇所が無くプロキシはデッドコードだった。`pnpm dev` の挙動には影響しない。

### 動作確認

- `pnpm build && pnpm start` で `/`・SPAルートは `index.html`、`/api/*` の未定義パスは 404 JSON、`/assets/*` は immutable キャッシュを返すことを確認。
- cwd を `/tmp` にして `node apps/api/dist/index.js` を起動しても dist を解決できることを確認（cwd非依存）。
- `ASAMIRU_WEB_DIST` の上書き（存在すれば配信／存在しなければ起動時エラー）と、dist 未生成時の API-only フォールバック（warn ログ）を確認。
