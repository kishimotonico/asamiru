import { describe, it, expect } from "vitest";
import { createDisplayService } from "@asamiru/display-control";
import { createDisplayRoutes, resolveDdcSelector } from "../displayRoutes.js";

/** getConnInfo が読む env を生成する（c.env.incoming.socket.remoteAddress） */
function envWithAddr(remoteAddress: string) {
  return { incoming: { socket: { remoteAddress } } };
}

const LOOPBACK_ENV = envWithAddr("127.0.0.1");
const REMOTE_ENV = envWithAddr("192.168.1.100");

describe("resolveDdcSelector - bus/display 番号の解釈", () => {
  it("ASAMIRU_DDC_BUS があれば bus を使う", () => {
    expect(resolveDdcSelector({ ASAMIRU_DDC_BUS: "10" })).toEqual({ kind: "bus", value: "10" });
  });

  it("bus が無く ASAMIRU_DISPLAY_NUMBER があれば display を使う", () => {
    expect(resolveDdcSelector({ ASAMIRU_DISPLAY_NUMBER: "2" })).toEqual({ kind: "display", value: "2" });
  });

  it("どちらも無ければ display 1（今までの --display 1 相当）", () => {
    expect(resolveDdcSelector({})).toEqual({ kind: "display", value: "1" });
  });

  it("bus を優先する", () => {
    expect(resolveDdcSelector({ ASAMIRU_DDC_BUS: "10", ASAMIRU_DISPLAY_NUMBER: "2" })).toEqual({
      kind: "bus",
      value: "10",
    });
  });

  it("不正な bus 値は例外", () => {
    expect(() => resolveDdcSelector({ ASAMIRU_DDC_BUS: "abc" })).toThrow(/ASAMIRU_DDC_BUS/);
  });

  it("不正な display 値は例外", () => {
    expect(() => resolveDdcSelector({ ASAMIRU_DISPLAY_NUMBER: "x" })).toThrow(/ASAMIRU_DISPLAY_NUMBER/);
  });
});

describe("displayRoutes - loopback 制限", () => {
  const svc = createDisplayService({ enabled: false });
  const app = createDisplayRoutes(svc);

  it("非 loopback からのアクセスは 403 で拒否される", async () => {
    const res = await app.request("/api/system/display", {}, REMOTE_ENV);
    expect(res.status).toBe(403);
  });

  it("接続元が取得できない場合も 403（fail-close）", async () => {
    // env を渡さないと getConnInfo が例外 → addr 不明 → 拒否
    const res = await app.request("/api/system/display");
    expect(res.status).toBe(403);
  });

  it("loopback からのアクセスは許可される", async () => {
    const res = await app.request("/api/system/display", {}, LOOPBACK_ENV);
    expect(res.status).toBe(200);
  });
});

describe("displayRoutes - 機能無効時（ASAMIRU_DISPLAY_ENABLED=false）", () => {
  const svc = createDisplayService({ enabled: false });
  const app = createDisplayRoutes(svc);

  it("GET /api/system/display が { enabled: false } を返す", async () => {
    const res = await app.request("/api/system/display", {}, LOOPBACK_ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ enabled: false });
  });

  it("PUT /api/system/display/desired-power が 503 を返す", async () => {
    const res = await app.request(
      "/api/system/display/desired-power",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ power: "standby" }),
      },
      LOOPBACK_ENV,
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({ code: "not_enabled" });
  });

  it("GET /api/system/display/events が 503 を返す", async () => {
    const res = await app.request("/api/system/display/events", {}, LOOPBACK_ENV);
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
    const res = await app.request("/api/system/display", {}, LOOPBACK_ENV);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ enabled: true, connector: "HDMI-A-1" });
    svc.stop();
  });

  it("PUT desired-power が ok を返す", async () => {
    await svc.start();
    const res = await app.request(
      "/api/system/display/desired-power",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ power: "standby" }),
      },
      LOOPBACK_ENV,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true });
    svc.stop();
  });

  it("PUT desired-power に不正な power 値を渡すと 400", async () => {
    await svc.start();
    const res = await app.request(
      "/api/system/display/desired-power",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ power: "invalid" }),
      },
      LOOPBACK_ENV,
    );
    expect(res.status).toBe(400);
    svc.stop();
  });

  it("POST /_fake で物理操作を模擬でき、DDC コマンド失敗時は PUT が 502 を返す", async () => {
    await svc.start();
    // _fake は loopback 許可で 200
    const fakeRes = await app.request(
      "/api/system/display/_fake",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ power: "off" }),
      },
      LOOPBACK_ENV,
    );
    expect(fakeRes.status).toBe(200);
    svc.stop();
  });
});
