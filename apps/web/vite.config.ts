import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import process from "process";

export default defineConfig({
  envDir: "../..",
  plugins: [react(), tailwindcss()],
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
