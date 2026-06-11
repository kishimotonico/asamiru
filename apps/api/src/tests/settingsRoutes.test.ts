import { describe, expect, it, vi } from "vitest";
import { createSettingsRoutes } from "../settingsRoutes.js";

describe("createSettingsRoutes", () => {
  it("GET /api/settings は保存済みの全設定を返す", async () => {
    const settings = { "asamiru-theme": "dark" };
    const read = vi.fn().mockResolvedValue(settings);
    const app = createSettingsRoutes({ read, write: vi.fn() });

    const response = await app.request("/api/settings");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(settings);
    expect(read).toHaveBeenCalledOnce();
  });

  it("PUT /api/settings は全設定を置き換えて同じ内容を返す", async () => {
    const settings = {
      "asamiru-theme": "system",
      "asamiru-calendar-settings": { icsUrls: ["https://calendar.example/private.ics"] },
    };
    const write = vi.fn().mockResolvedValue(undefined);
    const app = createSettingsRoutes({ read: vi.fn(), write });

    const response = await app.request("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(settings);
    expect(write).toHaveBeenCalledWith(settings);
  });

  it("PUT /api/settings は JSON オブジェクト以外を拒否する", async () => {
    const write = vi.fn();
    const app = createSettingsRoutes({ read: vi.fn(), write });

    const response = await app.request("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });

    expect(response.status).toBe(400);
    expect(write).not.toHaveBeenCalled();
  });
});
