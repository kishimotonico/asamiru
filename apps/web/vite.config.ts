import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "url";
import path from "path";
import process from "process";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, "../.."), "");

  return {
    envDir: "../..",
    plugins: [react(), tailwindcss()],
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
      proxy: {
        "/api": {
          target: env.VITE_API_ORIGIN ?? "http://asa-api.localhost:1355",
          changeOrigin: true,
        },
      },
    },
  };
});
