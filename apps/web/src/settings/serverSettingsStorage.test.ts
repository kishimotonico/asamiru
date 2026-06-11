// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initializeServerSettings,
  loadServerSettings,
  serverSettingsStorage,
} from "./serverSettingsStorage";

const KEY = "asamiru-test-settings";
const DEFAULTS = { location: "東京", count: 3, enabled: true };

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  initializeServerSettings({});
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("serverSettingsStorage", () => {
  it("デフォルト、localStorage、サーバーの順でシャローマージしサーバーを優先する", () => {
    localStorage.setItem(KEY, JSON.stringify({ location: "札幌", count: 5 }));
    initializeServerSettings({ [KEY]: { count: 8 } });

    const value = serverSettingsStorage(DEFAULTS).getItem(KEY, DEFAULTS);

    expect(value).toEqual({ location: "札幌", count: 8, enabled: true });
  });

  it("読み込んだサーバー優先値で localStorage キャッシュを更新する", () => {
    localStorage.setItem(KEY, JSON.stringify({ location: "札幌" }));
    initializeServerSettings({ [KEY]: { location: "仙台" } });

    const value = serverSettingsStorage(DEFAULTS).getItem(KEY, DEFAULTS);

    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual(value);
  });

  it("プリミティブ設定でもサーバー値を優先する", () => {
    localStorage.setItem("asamiru-theme", JSON.stringify("light"));
    initializeServerSettings({ "asamiru-theme": "dark" });

    const value = serverSettingsStorage("system").getItem("asamiru-theme", "system");

    expect(value).toBe("dark");
  });

  it("setItem は localStorage を同期更新し、1秒 debounce 後に全量 PUT する", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    initializeServerSettings({ "asamiru-theme": "dark" });
    const storage = serverSettingsStorage(DEFAULTS);

    storage.setItem(KEY, { ...DEFAULTS, location: "横浜" });

    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ ...DEFAULTS, location: "横浜" });
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "asamiru-theme": "dark",
        [KEY]: { ...DEFAULTS, location: "横浜" },
      }),
    });
  });

  it("連続更新は最後の変更から1秒後の1回にまとめる", async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    const storage = serverSettingsStorage(DEFAULTS);

    storage.setItem(KEY, { ...DEFAULTS, count: 4 });
    await vi.advanceTimersByTimeAsync(500);
    storage.setItem(KEY, { ...DEFAULTS, count: 5 });
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({ [KEY]: { ...DEFAULTS, count: 5 } });
  });
});

describe("loadServerSettings", () => {
  it("GET /api/settings の失敗を隠蔽しない", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));

    await expect(loadServerSettings()).rejects.toThrow(
      "GET /api/settings failed with status 503",
    );
  });
});
