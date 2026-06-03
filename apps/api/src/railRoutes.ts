import { Hono } from "hono";
import type { LineStatusResponse, RailDeparturesResponse, TrainLineStatus, WatchedLine } from "@asamiru/shared";
import { fetchDepartures } from "./departures.js";
import { LINE_STATUS_API, clearLineStatusCache, fetchLineStatus } from "./lineStatus.js";
import { recordDebugEvent } from "./metrics.js";
import { errorMessage } from "./errors.js";

const DEPARTURES_API = "rail/departures";
/** departures の上流取得に対するタイムアウト */
const DEPARTURES_TIMEOUT_MS = 5000;

/** 鉄道情報（運行情報・発車情報）の HTTP ルート。 */
export function createRailRoutes(): Hono {
  const app = new Hono();

  app.delete("/api/rail/line-status/cache", (c) => {
    const cleared = clearLineStatusCache();
    return c.json({ ok: true, cleared });
  });

  app.post("/api/rail/line-status", async (c) => {
    const body = await c.req.json<{ lines: WatchedLine[] }>();
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    recordDebugEvent({
      kind: "backend_request",
      api: LINE_STATUS_API,
      target: "POST /api/rail/line-status",
      summary: "Received line status request",
      detail: { lineCount: lines.length },
    });

    const results = await Promise.allSettled(lines.map((line) => fetchLineStatus(line)));
    const resolved: TrainLineStatus[] = [];
    const failures: string[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        resolved.push(result.value);
      } else {
        console.error("fetchLineStatus failed:", result.reason);
        failures.push(errorMessage(result.reason));
        recordDebugEvent({
          kind: "error",
          api: LINE_STATUS_API,
          target: "POST /api/rail/line-status",
          summary: "Line status request skipped a failed line",
          detail: { message: errorMessage(result.reason) },
        });
      }
    }

    if (lines.length > 0 && resolved.length === 0 && failures.length > 0) {
      return c.json({ error: `All line status requests failed: ${failures.join("; ")}` }, 502);
    }

    const response: LineStatusResponse = {
      lines: resolved,
      source: "yahoo-transit",
      fetchedAt: new Date().toISOString(),
    };
    c.header("Cache-Control", "public, max-age=300");
    return c.json(response);
  });

  app.post("/api/rail/departures", async (c) => {
    const body = await c.req.json<{ boardingStation?: string; displayCount?: number }>();
    const boardingStation = typeof body?.boardingStation === "string" ? body.boardingStation : "";
    const displayCount = Number(body?.displayCount);
    if (!boardingStation) {
      return c.json({ error: "boardingStation is required" }, 400);
    }
    recordDebugEvent({
      kind: "backend_request",
      api: DEPARTURES_API,
      target: "POST /api/rail/departures",
      summary: "Received departures request",
      detail: { boardingStation, displayCount },
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEPARTURES_TIMEOUT_MS);
    try {
      const response: RailDeparturesResponse = await fetchDepartures({
        boardingStation,
        displayCount,
        signal: controller.signal,
      });
      c.header("Cache-Control", "public, max-age=60");
      return c.json(response);
    } catch (error) {
      console.error("fetchDepartures failed:", error);
      recordDebugEvent({
        kind: "error",
        api: DEPARTURES_API,
        target: "POST /api/rail/departures",
        summary: "Departures request failed",
        detail: { boardingStation, displayCount, message: errorMessage(error) },
      });
      return c.json({ error: errorMessage(error) }, 502);
    } finally {
      clearTimeout(timeoutId);
    }
  });

  return app;
}
