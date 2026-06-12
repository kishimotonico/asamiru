// ─── 型ガードヘルパー ──────────────────────────────────────────────────────
// unknown な外部入力（localStorage・バックアップ JSON 等）の検証に使う共通ガード。

/** 配列を除くプレーンなオブジェクトかどうか。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 自身のプロパティとして key を持つか（プロトタイプ汚染を避けた hasOwnProperty）。 */
export function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/** 有限の number かどうか（NaN・Infinity は除外）。 */
export function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
