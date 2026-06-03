/**
 * 名前空間つきの軽量ロガー。
 *
 * - `info` / `debug` は診断用。開発時、または localStorage に `asamiru-debug=1` を
 *   セットしたときだけ出力する（本番 kiosk のコンソールを汚さない）。
 * - `warn` / `error` は異常系として常に出力する。
 *
 * バックエンド（packages/display-control）の `[display] ...` 形式の構造化ログと
 * 接頭辞を揃え、ブラウザ・サーバー両方のログを同じ目印で追えるようにする。
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const ALWAYS: ReadonlySet<LogLevel> = new Set(["warn", "error"]);

function diagnosticsEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return localStorage.getItem("asamiru-debug") === "1";
  } catch {
    return false;
  }
}

export type Logger = Record<LogLevel, (message: string, ...args: unknown[]) => void>;

export function createLogger(namespace: string): Logger {
  const emit = (level: LogLevel, message: string, args: unknown[]) => {
    if (!ALWAYS.has(level) && !diagnosticsEnabled()) return;
    const line = `[${namespace}] ${message}`;
    if (level === "error") console.error(line, ...args);
    else if (level === "warn") console.warn(line, ...args);
    else if (level === "info") console.info(line, ...args);
    else console.debug(line, ...args);
  };

  return {
    debug: (message, ...args) => emit("debug", message, args),
    info: (message, ...args) => emit("info", message, args),
    warn: (message, ...args) => emit("warn", message, args),
    error: (message, ...args) => emit("error", message, args),
  };
}
