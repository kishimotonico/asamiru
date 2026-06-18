// Vitest が #settings-catalog-active alias を正しく解決できるかを確認するスモークテスト。
import { describe, it, expect } from "vitest";
import { RAIL_CATALOG, SLEEP_CATALOG, WEATHER_CATALOG } from ".";
import { SLEEP_CATALOG as DEMO_SLEEP_CATALOG } from "./catalog.demo";
import { SLEEP_CATALOG as PRODUCTION_SLEEP_CATALOG } from "./catalog.production";

describe("RAIL_CATALOG (Vitest alias smoke)", () => {
  it("alias が解決されて stations を持つ", () => {
    expect(RAIL_CATALOG).toBeTruthy();
    expect(Array.isArray(RAIL_CATALOG.stations)).toBe(true);
    expect(RAIL_CATALOG.stations.length).toBeGreaterThan(0);
    expect(Array.isArray(RAIL_CATALOG.lines)).toBe(true);
    expect(RAIL_CATALOG.defaults).toBeTruthy();
  });
});

describe("WEATHER_CATALOG (Vitest alias smoke)", () => {
  it("alias が解決されて defaults を持つ", () => {
    expect(WEATHER_CATALOG.defaults).toBeTruthy();
    expect(typeof WEATHER_CATALOG.defaults.lat).toBe("number");
    expect(typeof WEATHER_CATALOG.defaults.lon).toBe("number");
    expect(WEATHER_CATALOG.defaults.locationName.length).toBeGreaterThan(0);
  });
});

describe("SLEEP_CATALOG (Vitest alias smoke)", () => {
  it("alias が解決されて defaults を持つ", () => {
    expect(SLEEP_CATALOG.defaults).toBeTruthy();
    expect(typeof SLEEP_CATALOG.defaults.enabled).toBe("boolean");
    expect(Array.isArray(SLEEP_CATALOG.defaults.windows)).toBe(true);
    expect(typeof SLEEP_CATALOG.defaults.manualWakeDurationMin).toBe("number");
  });

  it("本番とデモで自動スリープの初期値が切り替わる", () => {
    expect(PRODUCTION_SLEEP_CATALOG.defaults.enabled).toBe(true);
    expect(DEMO_SLEEP_CATALOG.defaults.enabled).toBe(false);
    expect(DEMO_SLEEP_CATALOG.defaults.windows).toEqual(PRODUCTION_SLEEP_CATALOG.defaults.windows);
    expect(DEMO_SLEEP_CATALOG.defaults.manualWakeDurationMin).toBe(
      PRODUCTION_SLEEP_CATALOG.defaults.manualWakeDurationMin,
    );
  });
});
