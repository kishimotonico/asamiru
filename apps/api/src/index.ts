import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDisplayServiceFromEnv } from "./displayRoutes.js";

const PORT = Number(process.env.PORT ?? 8787);

const displayService = createDisplayServiceFromEnv();
const app = createApp(displayService);

serve({ fetch: app.fetch, port: PORT }, async (info) => {
  console.log(`asamiru api listening on http://localhost:${info.port}`);
  await displayService.start();
  if (!displayService.enabled) {
    console.log("[display] disabled: set ASAMIRU_DISPLAY_ENABLED=true to enable monitor integration");
  }
});

// シグナルでモニター制御サービスを停止してから終了する
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    displayService.stop();
    process.exit(0);
  });
}
