import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSettings, settingsFilePath, writeSettings } from "../settingsStore.js";

let dataDirectory: string;

beforeEach(async () => {
  dataDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "asamiru-settings-"));
  process.env.ASAMIRU_DATA_DIR = dataDirectory;
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.ASAMIRU_DATA_DIR;
  await fs.rm(dataDirectory, { recursive: true, force: true });
});

describe("settingsStore", () => {
  it("未作成の settings.json は空オブジェクトとして読み込む", async () => {
    await expect(readSettings()).resolves.toEqual({});
  });

  it("設定を JSON ファイルへ保存して読み戻せる", async () => {
    const settings = {
      "asamiru-theme": "dark",
      "asamiru-weather-settings": { lat: 43.06, lon: 141.35 },
    };

    await writeSettings(settings);

    await expect(readSettings()).resolves.toEqual(settings);
  });

  it("rename に失敗しても既存ファイルを壊さず tmp ファイルを残さない", async () => {
    const original = { "asamiru-theme": "light" };
    await writeSettings(original);
    vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("rename failed"));

    await expect(writeSettings({ "asamiru-theme": "dark" })).rejects.toThrow("rename failed");

    await expect(readSettings()).resolves.toEqual(original);
    expect((await fs.readdir(dataDirectory)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("壊れた JSON はエラーとして扱う", async () => {
    await fs.writeFile(settingsFilePath(), "{invalid-json", "utf8");

    await expect(readSettings()).rejects.toThrow(SyntaxError);
  });
});
