import type { CalendarEvent, CalendarEventsRequest, CalendarEventsResponse } from "@asamiru/shared";
import ical from "node-ical";
import { BadRequestError } from "./errors.js";
import { recordDebugEvent, withUpstream } from "./metrics.js";
import { createTtlCache } from "./ttlCache.js";

export const CALENDAR_EVENTS_API = "calendar/events";

const CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 14;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const USER_AGENT = "asamiru/0.1 personal dashboard";

type CalendarDate = Date & {
  dateOnly?: boolean;
  tz?: string;
};

type ParsedEvent = {
  type?: unknown;
  summary?: unknown;
  start?: unknown;
  end?: unknown;
  rrule?: unknown;
  recurrenceid?: unknown;
};

type ExpandedEvent = {
  summary?: unknown;
  start?: unknown;
  end?: unknown;
  isFullDay?: unknown;
};

const cache = createTtlCache<string>({
  api: CALENDAR_EVENTS_API,
  cacheName: "ics-calendar",
  ttlMs: CACHE_TTL_MS,
});

export function clearCalendarCache(): number {
  return cache.clear();
}

export function normalizeCalendarUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BadRequestError("Invalid ICS URL");
  }

  if (url.protocol !== "https:") {
    throw new BadRequestError("ICS URL must use https");
  }
  return url.toString();
}

export function normalizeCalendarDays(days: number | undefined): number {
  if (days === undefined) {
    return DEFAULT_DAYS;
  }
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    throw new BadRequestError(`days must be an integer between 1 and ${MAX_DAYS}`);
  }
  return days;
}

export async function fetchCalendarEvents(
  request: CalendarEventsRequest,
  now = new Date(),
): Promise<CalendarEventsResponse> {
  if (!Array.isArray(request.icsUrls) || request.icsUrls.some((url) => typeof url !== "string")) {
    throw new BadRequestError("icsUrls must be an array of strings");
  }

  const days = normalizeCalendarDays(request.days);
  const urls = [...new Set(request.icsUrls.map(normalizeCalendarUrl))];
  const calendars = await Promise.all(urls.map(fetchCalendarText));
  const events = calendars
    .flatMap((icsText) => parseCalendarEvents(icsText, { now, days }))
    .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title, "ja"));

  return {
    events,
    checkedAt: now.toISOString(),
  };
}

export function parseCalendarEvents(
  icsText: string,
  { now = new Date(), days = DEFAULT_DAYS }: { now?: Date; days?: number } = {},
): CalendarEvent[] {
  const normalizedDays = normalizeCalendarDays(days);
  const rangeStart = startOfJstDay(now);
  const rangeEnd = new Date(rangeStart.getTime() + normalizedDays * 24 * 60 * 60 * 1000);
  const parsed = ical.sync.parseICS(icsText) as Record<string, ParsedEvent>;
  const events: CalendarEvent[] = [];

  for (const component of Object.values(parsed)) {
    if (component.type !== "VEVENT" || component.recurrenceid !== undefined) {
      continue;
    }

    const occurrences = component.rrule
      ? (ical.expandRecurringEvent(component as never, {
          from: rangeStart,
          to: rangeEnd,
          expandOngoing: true,
        }) as ExpandedEvent[])
      : [component];

    for (const occurrence of occurrences) {
      const event = normalizeParsedEvent(occurrence);
      if (new Date(event.start) < rangeEnd && new Date(event.end) > rangeStart) {
        events.push(event);
      }
    }
  }

  return events.sort(
    (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title, "ja"),
  );
}

async function fetchCalendarText(url: string): Promise<string> {
  const host = new URL(url).hostname;
  return cache.getOrFetch(
    url,
    {
      target: host,
      hitSummary: "Calendar served from cache",
      missSummary: "Calendar cache miss",
      inflightSummary: "Calendar request joined in-flight fetch",
      detail: { host },
    },
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await withUpstream(
          CALENDAR_EVENTS_API,
          host,
          async () => {
            try {
              return await fetch(url, {
                signal: controller.signal,
                headers: {
                  "User-Agent": USER_AGENT,
                  Accept: "text/calendar,text/plain;q=0.9",
                },
              });
            } catch {
              throw new Error(`Calendar upstream ${host} request failed`);
            }
          },
          { provider: "ics", host },
        );
        if (!response.ok) {
          recordDebugEvent({
            kind: "error",
            api: CALENDAR_EVENTS_API,
            target: host,
            summary: "Calendar upstream returned an error status",
            status: response.status,
            detail: { provider: "ics", host },
          });
          throw new Error(`Calendar upstream ${host} returned ${response.status}`);
        }

        return await response.text();
      } finally {
        clearTimeout(timeoutId);
      }
    },
  );
}

function normalizeParsedEvent(event: ExpandedEvent): CalendarEvent {
  const title = parameterText(event.summary);
  if (!title) {
    throw new Error("ICS event is missing a title");
  }
  if (!(event.start instanceof Date) || Number.isNaN(event.start.getTime())) {
    throw new Error(`ICS event has an invalid start: ${title}`);
  }
  const start = event.start as CalendarDate;
  const dateOnly = start.dateOnly === true || event.isFullDay === true;
  const end = normalizeEnd(event.end, start, dateOnly, title);
  const midnightToMidnight = isJstMidnight(start) && isJstMidnight(end);
  const allDay = dateOnly || midnightToMidnight;

  return {
    title,
    start: dateOnly ? dateOnlyToJstIso(start) : toJstIso(start),
    end: dateOnly ? dateOnlyToJstIso(end) : toJstIso(end),
    allDay,
  };
}

function parameterText(value: unknown): string | undefined {
  const text =
    typeof value === "string"
      ? value
      : typeof value === "object" && value !== null && "val" in value && typeof value.val === "string"
        ? value.val
        : undefined;
  const trimmed = text?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeEnd(value: unknown, start: CalendarDate, dateOnly: boolean, title: string): CalendarDate {
  if (value === undefined) {
    const end = new Date(start.getTime() + (dateOnly ? 24 * 60 * 60 * 1000 : 0)) as CalendarDate;
    if (dateOnly) {
      end.dateOnly = true;
    }
    if (start.tz) {
      end.tz = start.tz;
    }
    return end;
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error(`ICS event has an invalid end: ${title}`);
  }
  return value as CalendarDate;
}

function startOfJstDay(date: Date): Date {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - JST_OFFSET_MS);
}

function isJstMidnight(date: Date): boolean {
  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return shifted.getUTCHours() === 0 && shifted.getUTCMinutes() === 0 && shifted.getUTCSeconds() === 0;
}

function toJstIso(date: Date): string {
  return `${new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, -1)}+09:00`;
}

function dateOnlyToJstIso(date: CalendarDate): string {
  const parts = dateOnlyParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T00:00:00.000+09:00`;
}

function dateOnlyParts(date: CalendarDate): { year: string; month: string; day: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: date.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, part.value]),
  );
  if (!parts.year || !parts.month || !parts.day) {
    throw new Error("ICS event has an invalid all-day date");
  }
  return { year: parts.year, month: parts.month, day: parts.day };
}
