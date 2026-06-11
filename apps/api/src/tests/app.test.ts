import { describe, expect, it } from "vitest";
import { createDisplayService } from "@asamiru/display-control";
import { createApp } from "../app.js";

const app = createApp(createDisplayService({ enabled: false }));

describe("createApp の合成", () => {
  it("GET /api/health は ok を返す", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("GET /api/debug/metrics は metrics を返す", async () => {
    const res = await app.request("/api/debug/metrics");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { totals: unknown; events: unknown[] };
    expect(body).toHaveProperty("totals");
    expect(Array.isArray(body.events)).toBe(true);
  });

  it("POST /api/calendar/events はカレンダールートへ到達する", async () => {
    const res = await app.request("/api/calendar/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ icsUrls: [] }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [], checkedAt: expect.any(String) });
  });

  it("未知の /api/* は 404（catch-all が静的配信より先）", async () => {
    const res = await app.request("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });
});
