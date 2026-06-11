import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCalendarCache } from "../calendar.js";
import { createCalendarRoutes } from "../calendarRoutes.js";
import { getDebugMetrics } from "../metrics.js";

const app = createCalendarRoutes();

function post(body: unknown) {
  return app.request("/api/calendar/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  clearCalendarCache();
  vi.restoreAllMocks();
});

describe("createCalendarRoutes", () => {
  it("icsUrls が空ならネットワークアクセスせず空応答を返す", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await post({ icsUrls: [] });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ events: [], checkedAt: expect.any(String) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("http URL は 400 を返す", async () => {
    const response = await post({ icsUrls: ["http://calendar.example/private.ics"] });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "ICS URL must use https" });
  });

  it("icsUrls が配列でなければ 400 を返す", async () => {
    const response = await post({ icsUrls: "https://calendar.example/private.ics" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "icsUrls must be an array of strings" });
  });

  it("上流取得失敗時も秘密 URL 全文をデバッグイベントへ残さない", async () => {
    const secret = "route-test-secret-token";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error(`request to https://calendar.example/private.ics?token=${secret} failed`),
    );

    const response = await post({ icsUrls: [`https://calendar.example/private.ics?token=${secret}`] });

    expect(response.status).toBe(502);
    expect(JSON.stringify(getDebugMetrics().events)).not.toContain(secret);
  });
});
