import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 配信する Web ビルド（apps/web/dist）の場所を解決する。
 * ASAMIRU_WEB_DIST が指定されていればそれを使い、無ければ自身の位置から相対解決する。
 * 実行時の cwd に依存しないため、systemd などどこから起動しても同じ結果になる。
 */
export function resolveWebDistRoot(): string | undefined {
  const configured = process.env.ASAMIRU_WEB_DIST;
  if (configured) {
    const absolutePath = resolve(process.cwd(), configured);
    if (!existsSync(absolutePath)) {
      throw new Error(`ASAMIRU_WEB_DIST does not exist: ${absolutePath}`);
    }
    return absolutePath;
  }

  const distRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
  return existsSync(distRoot) ? distRoot : undefined;
}

/**
 * Web ビルドの静的配信を app に登録する。SPA フォールバックつき。
 * dist が見つからない場合は何も登録せず警告する（API のみで起動する）。
 */
export function registerStaticFiles(app: Hono): void {
  const root = resolveWebDistRoot();
  if (!root) {
    console.warn(
      "asamiru web dist was not found. Build the web app first or set ASAMIRU_WEB_DIST to serve the dashboard UI.",
    );
    return;
  }

  app.use(
    "/*",
    serveStatic({
      root,
      onFound: (path, c) => {
        c.header("Cache-Control", path.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
      },
    }),
  );
  app.get("*", serveStatic({ root, path: "index.html" }));
}
