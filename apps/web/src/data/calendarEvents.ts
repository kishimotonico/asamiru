import type { CalendarEventsRequest, CalendarEventsResponse } from "@asamiru/shared";
import { apiEndpoint } from "./apiEndpoint";

const CALENDAR_EVENTS_ENDPOINT = apiEndpoint("/api/calendar/events");

export async function fetchCalendarEvents(
  request: CalendarEventsRequest,
  { signal }: { signal?: AbortSignal } = {},
): Promise<CalendarEventsResponse> {
  const response = await fetch(CALENDAR_EVENTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Calendar events API returned ${response.status}`);
  }
  return (await response.json()) as CalendarEventsResponse;
}
