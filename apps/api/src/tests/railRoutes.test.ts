import { afterEach, describe, expect, it, vi } from "vitest";
import { createRailRoutes } from "../railRoutes.js";

const app = createRailRoutes();

function post(path: string, body: unknown) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createRailRoutes", () => {
  it("DELETE /api/rail/line-status/cache はキャッシュ件数を返す", async () => {
    const res = await app.request("/api/rail/line-status/cache", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, cleared: expect.any(Number) });
  });

  it("POST /api/rail/departures は boardingStation 必須で 400", async () => {
    const res = await post("/api/rail/departures", { displayCount: 3 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "boardingStation is required" });
  });

  it.each(["/api/rail/line-status", "/api/rail/departures"])("POST %s は不正な JSON で 400", async (path) => {
    const res = await app.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Request body must be valid JSON" });
  });

  it("POST /api/rail/line-status は空配列ならネットワークアクセスせず空応答を返す", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await post("/api/rail/line-status", { lines: [] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lines: unknown[]; source: string };
    expect(body.lines).toEqual([]);
    expect(body.source).toBe("yahoo-transit");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST /api/rail/line-status は全路線が失敗すると 502", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const res = await post("/api/rail/line-status", {
      lines: [{ name: "京王線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/102/0" }],
    });
    expect(res.status).toBe(502);
    expect((await res.json()) as { error: string }).toMatchObject({ error: expect.stringContaining("network down") });
  });
});
