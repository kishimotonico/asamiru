import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { load } from "cheerio";
import type { TrainLineStatus, TrainStatusResponse, WatchedLine } from "@asamiru/shared";

const PORT = Number(process.env.PORT ?? 8787);
const CACHE_TTL_MS = 2 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const USER_AGENT = "asamiru/0.1 personal dashboard";

const lineStatusCache = new Map<string, { value: TrainLineStatus; expiresAt: number }>();

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: ["http://asa.localhost:1355", "http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.delete("/api/train-status/cache", (c) => {
  const count = lineStatusCache.size;
  lineStatusCache.clear();
  return c.json({ ok: true, cleared: count });
});

app.post("/api/train-status", async (c) => {
  const body = await c.req.json<{ lines: WatchedLine[] }>();
  const lines = Array.isArray(body?.lines) ? body.lines : [];

  const results = await Promise.allSettled(lines.map((line) => fetchLineStatus(line)));
  const resolved: TrainLineStatus[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      resolved.push(result.value);
    } else {
      console.error("fetchLineStatus failed:", result.reason);
    }
  }

  const response: TrainStatusResponse = {
    lines: resolved,
    source: "yahoo-transit",
    fetchedAt: new Date().toISOString(),
  };
  c.header("Cache-Control", "public, max-age=30");
  return c.json(response);
});

async function fetchLineStatus(line: WatchedLine): Promise<TrainLineStatus> {
  const sourceUrl = normalizeYahooTransitInfoUrl(line.yahooUrl);
  const cached = lineStatusCache.get(sourceUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

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
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
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

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`asamiru api listening on http://localhost:${info.port}`);
  },
);
