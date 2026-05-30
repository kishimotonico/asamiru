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
      "/api": {
        target: process.env.VITE_API_ORIGIN ?? "http://asa-api.localhost:1355",
        changeOrigin: true,
      },
    },
  },
});
