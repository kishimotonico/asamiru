import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarEventsQueryOptions } from "./dashboardQueries";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("calendarEventsQueryOptions", () => {
  it("取得範囲をクエリキーへ含める", () => {
    const icsUrls = ["https://calendar.example/private.ics"];

    expect(calendarEventsQueryOptions(icsUrls).queryKey).toEqual([
      "dashboard",
      "calendar-events",
      { icsUrls, days: 14 },
    ]);
  });

  it("カレンダーAPIへ14日範囲を要求する", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ events: [], checkedAt: "2026-06-13T00:00:00.000Z" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    const options = calendarEventsQueryOptions(["https://calendar.example/private.ics"]);

    if (typeof options.queryFn !== "function") {
      throw new Error("calendar queryFn is not callable");
    }
    await options.queryFn({ signal: new AbortController().signal } as never);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/calendar/events",
      expect.objectContaining({
        body: JSON.stringify({
          icsUrls: ["https://calendar.example/private.ics"],
          days: 14,
        }),
      }),
    );
  });
});
