import { defineConfig } from "vitest/config";
import { settingsCatalogAlias } from "./catalog-alias";

export default defineConfig({
  resolve: {
    alias: settingsCatalogAlias(__dirname),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
