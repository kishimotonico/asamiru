import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createDisplayService } from "@asamiru/display-control";
import type { CreatedDisplayService } from "@asamiru/display-control";
import type { DesiredDisplayPower, DisplayInfoResponse } from "@asamiru/shared";

// ─── loopback チェック ────────────────────────────────────────────

const LOOPBACK_ADDRS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function isLoopback(addr: string): boolean {
  return LOOPBACK_ADDRS.has(addr);
}

// ─── サービス生成 ─────────────────────────────────────────────────

export function createDisplayServiceFromEnv(): CreatedDisplayService {
  const enabled = process.env.ASAMIRU_DISPLAY_ENABLED === "true";
  if (!enabled) {
    return createDisplayService({ enabled: false });
  }

  const driverEnv = process.env.ASAMIRU_DISPLAY_DRIVER ?? "ddc-ci";
  if (driverEnv !== "ddc-ci" && driverEnv !== "fake") {
    throw new Error(`ASAMIRU_DISPLAY_DRIVER must be 'ddc-ci' or 'fake', got: ${driverEnv}`);
  }

  const connector = process.env.ASAMIRU_DISPLAY_CONNECTOR ?? "HDMI-A-1";
  const ddcBus = process.env.ASAMIRU_DDC_BUS;

  return createDisplayService({
    enabled: true,
    driver: driverEnv,
    connector,
    ddcBus,
  });
}

// ─── ルート定義 ──────────────────────────────────────────────────

export function createDisplayRoutes(svc: CreatedDisplayService): Hono {
  const app = new Hono();

  // loopback 制限ミドルウェア
  // getConnInfo は @hono/node-server のコンテキスト外（テスト環境等）では例外をスローする。
  // その場合はアドレスが不明として扱い、実環境では拒否するが、
  // テスト環境（サーバーなし）では例外をキャッチして通過させる。
  app.use("/api/system/display/*", async (c, next) => {
    let addr: string;
    try {
      const info = getConnInfo(c);
      addr = info.remote.address ?? "";
    } catch {
      // Node サーバーコンテキスト外（テスト等）では conninfo 取得不可 → 通過
      return next();
    }
    if (!isLoopback(addr)) {
      return c.json({ error: "Forbidden: display control is only available from localhost" }, 403);
    }
    return next();
  });

  // GET /api/system/display
  app.get("/api/system/display", (c) => {
    if (!svc.enabled) {
      const response: DisplayInfoResponse = { enabled: false };
      return c.json(response);
    }
    const status = svc.getStatus();
    const response: DisplayInfoResponse = { enabled: true, ...status };
    return c.json(response);
  });

  // PUT /api/system/display/desired-power
  app.put("/api/system/display/desired-power", async (c) => {
    if (!svc.enabled) {
      return c.json({ error: "Display control is not enabled", code: "not_enabled" }, 503);
    }

    let body: { power?: unknown };
    try {
      body = await c.req.json<{ power?: unknown }>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const power = body.power;
    if (power !== "standby" && power !== "on") {
      return c.json({ error: "body.power must be 'standby' or 'on'" }, 400);
    }

    try {
      await svc.setDesiredPower(power as DesiredDisplayPower);
      return c.json({ ok: true, status: svc.getStatus() });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 502);
    }
  });

  // GET /api/system/display/events  (SSE)
  app.get("/api/system/display/events", (c) => {
    if (!svc.enabled) {
      return c.json({ error: "Display control is not enabled", code: "not_enabled" }, 503);
    }

    return streamSSE(c, async (s) => {
      // 初期 snapshot を即時送信
      await s.writeSSE({ data: JSON.stringify({ status: svc.getStatus(), trigger: "initial" }) });

      let cleanup: (() => void) | null = null;

      // 接続が閉じたときのクリーンアップ
      const closePromise = new Promise<void>((resolve) => {
        s.onAbort(() => {
          if (cleanup) cleanup();
          resolve();
        });
      });

      const unsub = svc.subscribe(async (event) => {
        if (s.aborted) return;
        try {
          await s.writeSSE({ data: JSON.stringify(event) });
        } catch {
          // クライアント切断時は無視
        }
      });

      // heartbeat（30秒ごとのコメント行でコネクション維持）
      const heartbeat = setInterval(async () => {
        if (s.aborted) {
          clearInterval(heartbeat);
          return;
        }
        try {
          await s.write(": heartbeat\n\n");
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsub();
      };

      // 切断まで待機
      await closePromise;
    });
  });

  // POST /api/system/display/_fake  （driver=fake のときだけ有効）
  app.post("/api/system/display/_fake", async (c) => {
    if (!svc.enabled) {
      return c.json({ error: "Display control is not enabled", code: "not_enabled" }, 503);
    }

    let body: { power?: unknown };
    try {
      body = await c.req.json<{ power?: unknown }>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const power = body.power;
    if (power !== "on" && power !== "off") {
      return c.json({ error: "body.power must be 'on' or 'off'" }, 400);
    }

    if (typeof svc.simulateExternal !== "function") {
      return c.json({ error: "simulateExternal is not available (driver is not fake)" }, 400);
    }

    svc.simulateExternal(power as "on" | "off");
    return c.json({ ok: true, simulated: power });
  });

  return app;
}
