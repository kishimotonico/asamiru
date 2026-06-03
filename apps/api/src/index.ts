import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { load } from "cheerio";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LineStatusResponse, RailDeparturesResponse, TrainLineStatus, WatchedLine } from "@asamiru/shared";
import { fetchDepartures } from "./departures.js";
import {
  createCorrelationId,
  getDebugMetrics,
  recordDebugEvent,
  runWithDebugContext,
  withUpstream,
} from "./metrics.js";
import { createDisplayServiceFromEnv, createDisplayRoutes } from "./displayRoutes.js";

const PORT = Number(process.env.PORT ?? 8787);
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const USER_AGENT = "asamiru/0.1 personal dashboard";
const WEB_DIST_ROOT = resolveWebDistRoot();

const lineStatusCache = new Map<string, { value: TrainLineStatus; expiresAt: number }>();

// ─── モニター電源制御サービス ────────────────────────────────────
const displayService = createDisplayServiceFromEnv();

const app = new Hono();
const LINE_STATUS_API = "rail/line-status";
const DEPARTURES_API = "rail/departures";

app.use(
  "/api/*",
  cors({
    origin: ["http://asa.localhost:1355", "http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);

app.use("/api/*", async (c, next) => {
  const correlationId = createCorrelationId();
  c.header("X-Correlation-Id", correlationId);
  return runWithDebugContext(correlationId, () => next());
});

// display ルートは cors / correlationId ミドルウェアの後、既存ルートの前に登録する
app.route("/", createDisplayRoutes(displayService));

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/debug/metrics", (c) => c.json(getDebugMetrics()));

app.delete("/api/rail/line-status/cache", (c) => {
  const count = lineStatusCache.size;
  lineStatusCache.clear();
  return c.json({ ok: true, cleared: count });
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
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
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

app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

if (WEB_DIST_ROOT) {
  app.use(
    "/*",
    serveStatic({
      root: WEB_DIST_ROOT,
      onFound: (path, c) => {
        c.header("Cache-Control", path.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
      },
    }),
  );
  app.get("*", serveStatic({ root: WEB_DIST_ROOT, path: "index.html" }));
} else {
  console.warn(
    "asamiru web dist was not found. Build the web app first or set ASAMIRU_WEB_DIST to serve the dashboard UI.",
  );
}

async function fetchLineStatus(line: WatchedLine): Promise<TrainLineStatus> {
  const sourceUrl = normalizeYahooTransitInfoUrl(line.yahooUrl);
  const cached = lineStatusCache.get(sourceUrl);
  if (cached && cached.expiresAt > Date.now()) {
    recordDebugEvent({
      kind: "cache_hit",
      api: LINE_STATUS_API,
      target: sourceUrl,
      summary: "Line status served from cache",
      detail: { lineName: line.name, cache: "line-status" },
    });
    return cached.value;
  }

  recordDebugEvent({
    kind: "cache_miss",
    api: LINE_STATUS_API,
    target: sourceUrl,
    summary: "Line status cache miss",
    detail: { lineName: line.name, cache: "line-status" },
  });
  const html = await fetchText(sourceUrl);
  const parsed = parseYahooTrainInfo(html);
  const status: TrainLineStatus = {
    name: parsed.sourceName,
    sourceUrl,
    checkedAt: new Date().toISOString(),
    status: parsed.status,
    level: parsed.level,
    note: parsed.note,
  };
  lineStatusCache.set(sourceUrl, { value: status, expiresAt: Date.now() + CACHE_TTL_MS });
  return status;
}

function normalizeYahooTransitInfoUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid Yahoo transit URL: ${rawUrl}`);
  }

  const match = url.pathname.match(/^\/diainfo\/(\d+)\/(\d+)\/?$/);
  if (url.protocol !== "https:" || url.hostname !== "transit.yahoo.co.jp" || !match) {
    throw new Error(`Unsupported Yahoo transit URL: ${rawUrl}`);
  }

  return `https://transit.yahoo.co.jp/diainfo/${match[1]}/${match[2]}`;
}

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await withUpstream(
      LINE_STATUS_API,
      url,
      () =>
        fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "text/html,application/xhtml+xml",
          },
        }),
      { provider: "yahoo-transit" },
    );
    if (!response.ok) {
      recordDebugEvent({
        kind: "error",
        api: LINE_STATUS_API,
        target: url,
        summary: "Yahoo transit returned an error status",
        status: response.status,
        detail: { provider: "yahoo-transit" },
      });
      throw new Error(`Yahoo transit returned ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseYahooTrainInfo(
  html: string,
): Pick<TrainLineStatus, "status" | "level" | "note"> & { sourceName: string } {
  const $ = load(html);
  const sourceName = cleanText($(".labelLarge h1.title").first().text());
  const statusRoot = $("#mdServiceStatus").first();

  if (!sourceName || !statusRoot.length) {
    throw new Error("Yahoo transit response is not parseable");
  }

  const status = cleanText(statusRoot.find("dt").first().text());
  if (!status) {
    throw new Error(`Yahoo transit response has no status: ${sourceName}`);
  }

  const note =
    statusRoot
      .find("dd p")
      .map((_, element) => cleanText($(element).text()))
      .get()
      .filter((text) => text && text !== status)
      .join(" ") || undefined;

  return {
    sourceName,
    status,
    level: status === "平常運転" ? "ok" : "warn",
    note,
  };
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}

function resolveWebDistRoot(): string | undefined {
  const configured = process.env.ASAMIRU_WEB_DIST;
  if (configured) {
    const absolutePath = resolve(process.cwd(), configured);
    if (!existsSync(absolutePath)) {
      throw new Error(`ASAMIRU_WEB_DIST does not exist: ${absolutePath}`);
    }
    return absolutePath;
  }

  // apps/api/dist/index.js（dev時は apps/api/src/index.ts）を基準に apps/web/dist を解決する。
  // 実行時の cwd に依存しないため、systemd などどこから起動しても同じ結果になる。
  const distRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
  return existsSync(distRoot) ? distRoot : undefined;
}

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  async (info) => {
    console.log(`asamiru api listening on http://localhost:${info.port}`);
    await displayService.start();
    if (displayService.enabled) {
      console.log(
        `display control enabled: connector=${process.env.ASAMIRU_DISPLAY_CONNECTOR ?? "HDMI-A-1"} driver=${process.env.ASAMIRU_DISPLAY_DRIVER ?? "ddc-ci"}`,
      );
    }
  },
);

// シグナルハンドラーでサービスを停止
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    displayService.stop();
    process.exit(0);
  });
}
