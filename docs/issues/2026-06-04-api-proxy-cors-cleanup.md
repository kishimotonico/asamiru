# API接続の整理: Vite proxy 導入 + CORS 撤廃

## 背景

dev 環境では web（`*.asa.localhost:1355`）と API（`*.asa-api.localhost:1355`）が別オリジンで動作するため、
クライアントは `apiEndpoint.ts` でホスト名を `asa.→asa-api.` 置換して絶対 URL を組み立て、
API 側（`app.ts`）は `CORS_ORIGINS` で許可オリジンを列挙する二重管理になっていた。

これにより worktree のサブドメイン（`worktree-front-renew.asa.localhost`）が CORS 許可リストから漏れ、
交通カードが「取得失敗」（Failed to fetch）になる問題が発生した。

かつて Vite dev proxy があったが `bfd42a4`「絶対 URL 直叩きに移行済みでデッドコード」として削除された。
当時は絶対 URL + CORS の構成に切り替わっていたため proxy が不要になったが、
worktree ごとに CORS 許可が必要になる問題が顕在化した。

## 解決策

Vite proxy を正しく復活させ、dev でも本番でも **ブラウザが相対パス `/api` で API に到達する** 構成へ統一。
CORS とオリジン導出ロジックを丸ごと撤廃。

### 設計のポイント

portless の内部ポートは起動ごとに動的割当なので `target` に固定ポートを指定できない。
代わりに portless 自体が `PORTLESS_PORT`（既定 1355）で待ち受けているため:

- `target: http://127.0.0.1:1355`（portless の待受ポート。`.localhost` の名前解決に依存しない）
- `configure` の `proxyReq` イベントで Host ヘッダを `asa. → asa-api.` に置換
- worktree prefix（`worktree-foo.`）も正規表現 `/^([^.]*\.)?asa\./` でそのまま保持

```
ブラウザ（fetch /api/rail/departures）
  → Vite dev server（proxy）
  → host: worktree-front-renew.asa-api.localhost:1355 → 127.0.0.1:1355 へ転送
  → portless が routes.json でルーティング
  → Hono API サーバー（127.0.0.1:4808 等）
```

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `apps/web/vite.config.ts` | `/api` proxy を追加（target=127.0.0.1:1355、Host 書き換え） |
| `apps/web/src/data/apiEndpoint.ts` | オリジン導出を撤廃し相対パスを返すだけに |
| `apps/api/src/app.ts` | CORS ミドルウェア（`hono/cors` import・`isAllowedOrigin`・`app.use`）を削除 |
| `.env.example` | `VITE_API_ORIGIN` のコメントを削除 |
| `README.md` | API オリジン導出の記述を proxy 説明に更新 |
| `ARCHITECTURE.md` | CORS の記述を削除し proxy による同一オリジン化を追記 |
