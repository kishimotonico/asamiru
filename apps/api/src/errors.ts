/** unknown なエラーから安全にメッセージ文字列を取り出す。 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
