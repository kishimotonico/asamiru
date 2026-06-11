// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { mergedStorage } from "./mergedStorage";

const KEY = "asamiru-test-settings";

type Settings = {
  lat: number;
  lon: number;
  locationName: string;
};

const DEFAULT_SETTINGS: Settings = {
  lat: 35.6895,
  lon: 139.6917,
  locationName: "東京",
};

afterEach(() => {
  localStorage.clear();
});

describe("mergedStorage.getItem", () => {
  it("localStorage に値が無い場合は initialValue をそのまま返す", () => {
    const storage = mergedStorage(DEFAULT_SETTINGS);
    expect(storage.getItem(KEY, DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it("localStorage の値と initialValue をシャローマージして返す", () => {
    localStorage.setItem(KEY, JSON.stringify({ locationName: "札幌" }));

    const storage = mergedStorage(DEFAULT_SETTINGS);
    expect(storage.getItem(KEY, DEFAULT_SETTINGS)).toEqual({
      lat: 35.6895,
      lon: 139.6917,
      locationName: "札幌",
    });
  });

  it("localStorage の値が initialValue の全フィールドを上書きできる", () => {
    const stored: Settings = { lat: 43.06, lon: 141.35, locationName: "札幌" };
    localStorage.setItem(KEY, JSON.stringify(stored));

    const storage = mergedStorage(DEFAULT_SETTINGS);
    expect(storage.getItem(KEY, DEFAULT_SETTINGS)).toEqual(stored);
  });

  it("空文字の場合は initialValue を返す", () => {
    localStorage.setItem(KEY, "");

    const storage = mergedStorage(DEFAULT_SETTINGS);
    expect(storage.getItem(KEY, DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it("JSON として parse できない場合は initialValue を返す", () => {
    localStorage.setItem(KEY, "{invalid-json");

    const storage = mergedStorage(DEFAULT_SETTINGS);
    expect(storage.getItem(KEY, DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it("保存後にスキーマへフィールドが追加されても、新フィールドはデフォルト値で補完される（後方互換）", () => {
    // 旧バージョンで保存された値には locationName が無い
    const legacyStored = { lat: 43.06, lon: 141.35 };
    localStorage.setItem(KEY, JSON.stringify(legacyStored));

    const storage = mergedStorage(DEFAULT_SETTINGS);
    const result = storage.getItem(KEY, DEFAULT_SETTINGS);

    expect(result).toEqual({
      lat: 43.06,
      lon: 141.35,
      locationName: "東京", // デフォルト値で補完される
    });
  });
});

describe("mergedStorage.setItem / removeItem", () => {
  it("setItem は値を JSON 文字列として保存する", () => {
    const storage = mergedStorage(DEFAULT_SETTINGS);
    const value: Settings = { lat: 1, lon: 2, locationName: "テスト" };

    storage.setItem(KEY, value);

    expect(localStorage.getItem(KEY)).toBe(JSON.stringify(value));
  });

  it("removeItem は localStorage からキーを削除する", () => {
    localStorage.setItem(KEY, JSON.stringify(DEFAULT_SETTINGS));

    const storage = mergedStorage(DEFAULT_SETTINGS);
    storage.removeItem(KEY);

    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
