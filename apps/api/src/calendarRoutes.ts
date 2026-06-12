import type { CalendarEventsRequest, CalendarEventsResponse } from "@asamiru/shared";
import { Hono } from "hono";
import { CALENDAR_EVENTS_API, clearCalendarCache, fetchCalendarEvents } from "./calendar.js";
import { BadRequestError, errorMessage } from "./errors.js";
import { recordDebugEvent } from "./metrics.js";

export function createCalendarRoutes(): Hono {
  const app = new Hono();

  app.delete("/api/calendar/cache", (c) => {
    const cleared = clearCalendarCache();
    return c.json({ ok: true, cleared });
  });

  app.post("/api/calendar/events", async (c) => {
    let body: CalendarEventsRequest;
    try {
      body = await c.req.json<CalendarEventsRequest>();
    } catch {
      return c.json({ error: "Request body must be valid JSON" }, 400);
    }

    if (!Array.isArray(body?.icsUrls)) {
      return c.json({ error: "icsUrls must be an array of strings" }, 400);
    }
    const icsUrls = body.icsUrls;
    recordDebugEvent({
      kind: "backend_request",
      api: CALENDAR_EVENTS_API,
      target: "POST /api/calendar/events",
      summary: "Received calendar events request",
      detail: { calendarCount: icsUrls.length, days: body?.days },
    });

    if (icsUrls.length === 0) {
      const response: CalendarEventsResponse = { events: [], checkedAt: new Date().toISOString() };
      return c.json(response);
    }

    try {
      const response = await fetchCalendarEvents({ icsUrls, days: body.days });
      return c.json(response);
    } catch (error) {
      const message = errorMessage(error);
      recordDebugEvent({
        kind: "error",
        api: CALENDAR_EVENTS_API,
        target: "POST /api/calendar/events",
        summary: "Calendar events request failed",
        detail: { calendarCount: icsUrls.length, message },
      });
      const status = error instanceof BadRequestError ? 400 : 502;
      return c.json({ error: message }, status);
    }
  });

  return app;
}
