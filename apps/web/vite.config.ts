import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import process from "process";
import path from "path";

/**
 * settings/catalog/active の import を VITE_DEMO_MODE に応じて
 * catalog.production.ts または catalog.demo.ts に差し替えるプラグイン。
 *
 * Vite の alias は raw import specifier に対してマッチするため
 * 相対パス "./active" には絶対パスキーが一致しない。
 * resolveId フックで importer を見て確実にリダイレクトする。
 */
function catalogActivePlugin(): Plugin {
  const isDemoMode = process.env.VITE_DEMO_MODE === "true";
  const catalogFile = isDemoMode ? "catalog.demo.ts" : "catalog.production.ts";
  const catalogPath = path.resolve(__dirname, "src/settings/catalog", catalogFile);

  return {
    name: "catalog-active-alias",
    resolveId(source, importer) {
      if (
        source === "./active" &&
        importer !== undefined &&
        importer.includes("/settings/catalog/")
      ) {
        return catalogPath;
      }
    },
  };
}

export default defineConfig({
  envDir: "../..",
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [catalogActivePlugin(), react(), tailwindcss()],
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    proxy: {
      // portless の内部ポートは動的なため 127.0.0.1:PORTLESS_PORT へ転送し、
      // Host ヘッダを asa. → asa-api. に置換して portless にルーティングさせる。
      "/api": {
        target: `http://127.0.0.1:${process.env.PORTLESS_PORT ?? "1355"}`,
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const host = req.headers.host ?? "asa.localhost:1355";
            proxyReq.setHeader("host", host.replace(/^([^.]*\.)?asa\./, "$1asa-api."));
          });
        },
      },
    },
  },
});
