/** クライアント起因のリクエスト不正を表すエラー。ルート側で HTTP 400 に対応づける。 */
export class BadRequestError extends Error {}

/** unknown なエラーから安全にメッセージ文字列を取り出す。 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
