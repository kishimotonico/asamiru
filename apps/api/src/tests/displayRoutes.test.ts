import { describe, it, expect } from "vitest";
import { createDisplayService } from "@asamiru/display-control";
import { createDisplayRoutes } from "../displayRoutes.js";

/** loopback 偽装の Request を生成するヘルパー */
function makeRequest(url: string, opts: RequestInit = {}): Request {
  return new Request(`http://127.0.0.1${url}`, opts);
}

/** 非 loopback の Request を生成するヘルパー */
function makeRemoteRequest(url: string, opts: RequestInit = {}): Request {
  return new Request(`http://192.168.1.100${url}`, opts);
}

/** @hono/node-server の conninfo を模擬するため、カスタム変数を使う */
async function invokeWithLoopback(
  app: ReturnType<typeof createDisplayRoutes>,
  url: string,
  opts: RequestInit = {},
): Promise<Response> {
  // loopback アドレスを simulateするため env に設定
  const req = makeRequest(url, opts);
  // Hono のテストには .request() を使う
  return app.request(url, {
    ...opts,
    headers: {
      ...(opts.headers as Record<string, string>),
      "x-forwarded-for": "127.0.0.1",
    },
  });
}

describe("displayRoutes - 機能無効時（ASAMIRU_DISPLAY_ENABLED=false）", () => {
  const svc = createDisplayService({ enabled: false });
  const app = createDisplayRoutes(svc);

  it("GET /api/system/display が { enabled: false } を返す", async () => {
    const res = await app.request("/api/system/display");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ enabled: false });
  });

  it("PUT /api/system/display/desired-power が 503 を返す", async () => {
    const res = await app.request("/api/system/display/desired-power", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ power: "standby" }),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ code: "not_enabled" });
  });

  it("GET /api/system/display/events が 503 を返す", async () => {
    const res = await app.request("/api/system/display/events");
    expect(res.status).toBe(503);
  });
});

describe("displayRoutes - 機能有効時（fake driver）", () => {
  const svc = createDisplayService({
    enabled: true,
    driver: "fake",
    connector: "HDMI-A-1",
  });
  const app = createDisplayRoutes(svc);

  it("GET /api/system/display が enabled:true と status を返す", async () => {
    await svc.start();
    const res = await app.request("/api/system/display");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ enabled: true, connector: "HDMI-A-1" });
    svc.stop();
  });

  it("PUT desired-power が ok を返す", async () => {
    await svc.start();
    const res = await app.request("/api/system/display/desired-power", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ power: "standby" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    svc.stop();
  });

  it("PUT desired-power に不正な power 値を渡すと 400", async () => {
    await svc.start();
    const res = await app.request("/api/system/display/desired-power", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ power: "invalid" }),
    });
    expect(res.status).toBe(400);
    svc.stop();
  });
});
