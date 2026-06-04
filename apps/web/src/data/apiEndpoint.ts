// dev は Vite proxy（vite.config.ts）が /api を API サーバーへ転送する。
// 本番は API（Hono）が apps/web/dist を同一オリジンで静的配信する。
// どちらもブラウザからは相対パスで到達するため、オリジン導出は不要。
export function apiEndpoint(path: `/api/${string}`): string {
  return path;
}
