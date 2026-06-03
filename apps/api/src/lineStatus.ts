import { load } from "cheerio";
import type { TrainLineStatus, WatchedLine } from "@asamiru/shared";
import { recordDebugEvent, withUpstream } from "./metrics.js";

const LINE_STATUS_API = "rail/line-status";
const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5000;
const USER_AGENT = "asamiru/0.1 personal dashboard";

export { LINE_STATUS_API };

const cache = new Map<string, { value: TrainLineStatus; expiresAt: number }>();

/** 路線運行情報キャッシュを破棄し、件数を返す。 */
export function clearLineStatusCache(): number {
  const count = cache.size;
  cache.clear();
  return count;
}

/** Yahoo!路線情報から1路線の運行状況を取得する（TTLキャッシュつき）。 */
export async function fetchLineStatus(line: WatchedLine): Promise<TrainLineStatus> {
  const sourceUrl = normalizeYahooTransitInfoUrl(line.yahooUrl);
  const cached = cache.get(sourceUrl);
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
  cache.set(sourceUrl, { value: status, expiresAt: Date.now() + CACHE_TTL_MS });
  return status;
}

/** Yahoo!路線情報の diainfo URL を検証・正規化する。不正なら例外。 */
export function normalizeYahooTransitInfoUrl(rawUrl: string): string {
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
