import path from "path";

/**
 * VITE_DEMO_MODE に応じて "#rail-catalog-active" を
 * catalog.production.ts または catalog.demo.ts に解決する alias マップ。
 *
 * Vite と Vitest の両 config から参照することで、
 * build/preview とテスト runtime で同じ解決結果が得られる。
 *
 * @param rootDir - 各 config ファイルの __dirname を渡す
 */
export function railCatalogAlias(rootDir: string): Record<string, string> {
  const isDemoMode = process.env.VITE_DEMO_MODE === "true";
  return {
    "#rail-catalog-active": path.resolve(
      rootDir,
      "src/settings/catalog",
      isDemoMode ? "catalog.demo.ts" : "catalog.production.ts",
    ),
  };
}
