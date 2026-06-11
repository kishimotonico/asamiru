import { defineConfig } from "vitest/config";
import { railCatalogAlias } from "./catalog-alias";

export default defineConfig({
  resolve: {
    alias: railCatalogAlias(__dirname),
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
