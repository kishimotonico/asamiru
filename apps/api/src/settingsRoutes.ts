import { Hono } from "hono";
import { readSettings, writeSettings, type SettingsRecord } from "./settingsStore.js";

type SettingsStore = {
  read: () => Promise<SettingsRecord>;
  write: (settings: SettingsRecord) => Promise<void>;
};

const defaultStore: SettingsStore = {
  read: readSettings,
  write: writeSettings,
};

function isSettingsRecord(value: unknown): value is SettingsRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createSettingsRoutes(store: SettingsStore = defaultStore): Hono {
  const app = new Hono();

  app.get("/api/settings", async (c) => c.json(await store.read()));

  app.put("/api/settings", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Request body must be valid JSON" }, 400);
    }

    if (!isSettingsRecord(body)) {
      return c.json({ error: "Request body must be a JSON object" }, 400);
    }

    await store.write(body);
    return c.json(body);
  });

  return app;
}
