// dev 時は web と API が別オリジン（portless）になる。
// VITE_API_ORIGIN が指定されていればそれを使う（任意のオーバーライド）。
// 未指定なら、現在の web ホストの asa ラベルを asa-api に置換して導出する。
// web は asa(.localhost)、API は asa-api(.localhost) で動き、git worktree では
// 先頭に prefix（例: worktree-front-renew.）が付くが、その prefix も引き継がれる。
// 本番は API が web を同一オリジンで配信するため origin は空文字。
function devApiOrigin(): string {
  const override = import.meta.env.VITE_API_ORIGIN;
  if (override) return override;

  const { protocol, host } = window.location;
  const apiHost = host.replace(/^([^.]*\.)?asa\./, "$1asa-api.");
  if (apiHost === host) {
    throw new Error(
      `dev: web ホスト "${host}" から API オリジンを導出できません。portless 経由（asa.localhost）でアクセスするか、VITE_API_ORIGIN を指定してください。`,
    );
  }
  return `${protocol}//${apiHost}`;
}

export function apiEndpoint(path: `/api/${string}`): string {
  const origin = import.meta.env.DEV ? devApiOrigin() : "";
  return `${origin}${path}`;
}
