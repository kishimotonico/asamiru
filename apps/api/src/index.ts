import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { load } from "cheerio";
import { type TrainLineStatus, type TrainStatusResponse, watchedTrainLines } from "@asamiru/shared";

const PORT = Number(process.env.PORT ?? 8787);
const CACHE_TTL_MS = 2 * 60 * 1000;
const ERROR_TTL_MS = 30 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const USER_AGENT = "asamiru/0.1 personal dashboard";

let trainStatusCache: { value: TrainStatusResponse; expiresAt: number } | undefined;
let trainStatusErrorCache: { expiresAt: number } | undefined;
let trainStatusInflight: Promise<TrainStatusResponse> | undefined;

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: ["http://asa.localhost:1355", "http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/train-status", async (c) => {
  const response = await getTrainStatus();
  c.header("Cache-Control", "public, max-age=30");
  return c.json(response);
});

async function getTrainStatus(): Promise<TrainStatusResponse> {
  const now = Date.now();
  if (trainStatusCache && trainStatusCache.expiresAt > now) {
    return trainStatusCache.value;
  }
  if (trainStatusErrorCache && trainStatusErrorCache.expiresAt > now) {
    throw new Error("train status fetch in backoff period");
  }
  if (trainStatusInflight) {
    return trainStatusInflight;
  }

  trainStatusInflight = Promise.allSettled(watchedTrainLines.map(fetchLineStatus))
    .then((results) => {
      const lines: TrainLineStatus[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          lines.push(result.value);
        } else {
          console.error("fetchLineStatus failed:", result.reason);
        }
      }
      if (lines.length === 0) {
        throw new Error("all train line fetches failed");
      }
      const value: TrainStatusResponse = {
        lines,
        source: "yahoo-transit",
        fetchedAt: new Date().toISOString(),
      };
      trainStatusCache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    })
    .catch((err: unknown) => {
      trainStatusErrorCache = { expiresAt: Date.now() + ERROR_TTL_MS };
      throw err;
    })
    .finally(() => {
      trainStatusInflight = undefined;
    });

  return trainStatusInflight;
}

async function fetchLineStatus(line: (typeof watchedTrainLines)[number]): Promise<TrainLineStatus> {
  const html = await fetchText(line.yahooUrl);
  const parsed = parseYahooTrainInfo(html);

  return {
    id: line.id,
    name: line.name,
    sourceUrl: line.yahooUrl,
    checkedAt: new Date().toISOString(),
    ...parsed,
  };
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

function parseYahooTrainInfo(html: string): Pick<TrainLineStatus, "status" | "level" | "note"> {
  const $ = load(html);
  const heading = $(".elmTblLstLine h1").first().text().trim();
  const statusText = $(
    ".elmTblLstLine .icnNormalLarge, .elmTblLstLine .icnAlertLarge, .elmTblLstLine .icnCautionLarge",
  )
    .first()
    .text()
    .trim();

  const status = statusText || inferStatus($("body").text());
  if (!status) {
    throw new Error(`Yahoo transit response is not parseable${heading ? `: ${heading}` : ""}`);
  }

  const note = $(".elmTblLstLine p, #mdServiceStatus p, .trouble p")
    .map((_, element) => $(element).text().replace(/\s+/g, " ").trim())
    .get()
    .filter((t) => t && t !== status)
    .join(" ") || undefined;

  return {
    status,
    level: status === "平常運転" ? "ok" : "warn",
    note,
  };
}

function inferStatus(text: string): string | undefined {
  if (text.includes("平常運転")) return "平常運転";
  if (text.includes("運転見合わせ")) return "運転見合わせ";
  if (text.includes("遅延")) return "遅延";
  return undefined;
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
