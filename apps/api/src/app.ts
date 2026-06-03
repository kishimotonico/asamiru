import { Hono } from "hono";
import { cors } from "hono/cors";
import type { CreatedDisplayService } from "@asamiru/display-control";
import { createCorrelationId, getDebugMetrics, runWithDebugContext } from "./metrics.js";
import { createDisplayRoutes } from "./displayRoutes.js";
import { createRailRoutes } from "./railRoutes.js";
import { registerStaticFiles } from "./staticFiles.js";

const CORS_ORIGINS = ["http://asa.localhost:1355", "http://localhost:5173", "http://127.0.0.1:5173"];

/**
 * アプリの合成ルート。ミドルウェア → 各ルート → 静的配信の順で組み立てた Hono を返す。
 * 登録順がマッチ順になるため、API の 404 catch-all は全 API ルートの後・静的配信の前に置く。
 */
export function createApp(displayService: CreatedDisplayService): Hono {
  const app = new Hono();

  app.use("/api/*", cors({ origin: CORS_ORIGINS }));

  // correlation-id を付与し、デバッグ計測のコンテキストを伝播する
  app.use("/api/*", async (c, next) => {
    const correlationId = createCorrelationId();
    c.header("X-Correlation-Id", correlationId);
    return runWithDebugContext(correlationId, () => next());
  });

  // display ルートは cors / correlationId の後、既存 API ルートの前に登録する
  app.route("/", createDisplayRoutes(displayService));

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.get("/api/debug/metrics", (c) => c.json(getDebugMetrics()));

  app.route("/", createRailRoutes());

  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

  registerStaticFiles(app);

  return app;
}
