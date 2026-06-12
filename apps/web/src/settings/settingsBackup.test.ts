// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import {
  applySettingsBackup,
  createSettingsBackup,
  parseSettingsBackup,
  SETTINGS_BACKUP_APP,
  SETTINGS_BACKUP_VERSION,
  SETTINGS_STORAGE_KEYS,
} from "./settingsBackup";

const [WEATHER_KEY, TRAINS_KEY, CALENDAR_KEY] = SETTINGS_STORAGE_KEYS;
const EXPORTED_AT = new Date("2026-06-12T03:04:05.000Z");

afterEach(() => {
  localStorage.clear();
});

describe("createSettingsBackup", () => {
  it("存在する既知キーだけを JSON 値として生成する", () => {
    localStorage.setItem(WEATHER_KEY, JSON.stringify({ lat: 35.68, lon: 139.76, locationName: "東京" }));
    localStorage.setItem(CALENDAR_KEY, JSON.stringify({ icsUrls: ["https://example.com/calendar.ics"] }));
    localStorage.setItem("asamiru-unknown", JSON.stringify({ ignored: true }));

    expect(createSettingsBackup(localStorage, EXPORTED_AT)).toEqual({
      app: SETTINGS_BACKUP_APP,
      version: SETTINGS_BACKUP_VERSION,
      exportedAt: "2026-06-12T03:04:05.000Z",
      settings: {
        [WEATHER_KEY]: { lat: 35.68, lon: 139.76, locationName: "東京" },
        [CALENDAR_KEY]: { icsUrls: ["https://example.com/calendar.ics"] },
      },
    });
  });
});

describe("parseSettingsBackup / applySettingsBackup", () => {
  it("エクスポートした設定を別の localStorage 状態へ復元できる", () => {
    const weather = { lat: 43.06, lon: 141.35, locationName: "札幌" };
    const trains = { boardingStation: "札幌", watchedLines: [] };
    localStorage.setItem(WEATHER_KEY, JSON.stringify(weather));
    localStorage.setItem(TRAINS_KEY, JSON.stringify(trains));
    const json = JSON.stringify(createSettingsBackup(localStorage, EXPORTED_AT));

    localStorage.clear();
    applySettingsBackup(localStorage, parseSettingsBackup(json));

    expect(JSON.parse(localStorage.getItem(WEATHER_KEY) ?? "null")).toEqual(weather);
    expect(JSON.parse(localStorage.getItem(TRAINS_KEY) ?? "null")).toEqual(trains);
  });

  it("既知キーの値だけを localStorage に書き込む", () => {
    applySettingsBackup(localStorage, {
      [WEATHER_KEY]: { lat: 1, lon: 2, locationName: "テスト" },
      "asamiru-unknown": { ignored: true },
    });

    expect(localStorage.getItem(WEATHER_KEY)).toBe('{"lat":1,"lon":2,"locationName":"テスト"}');
    expect(localStorage.getItem("asamiru-unknown")).toBeNull();
  });

  it("不正な JSON を拒否する", () => {
    expect(() => parseSettingsBackup("{invalid-json")).toThrow("正しい JSON ではありません");
  });

  it("未知キーしか含まないバックアップを拒否する", () => {
    const json = JSON.stringify({
      app: SETTINGS_BACKUP_APP,
      version: SETTINGS_BACKUP_VERSION,
      settings: { "asamiru-unknown": { value: true } },
    });

    expect(() => parseSettingsBackup(json)).toThrow("既知の設定が1件も含まれていません");
  });

  it("version が一致しないバックアップを拒否する", () => {
    const json = JSON.stringify({
      app: SETTINGS_BACKUP_APP,
      version: SETTINGS_BACKUP_VERSION + 1,
      settings: { [WEATHER_KEY]: {} },
    });

    expect(() => parseSettingsBackup(json)).toThrow("対応していないバックアップバージョンです");
  });
});
