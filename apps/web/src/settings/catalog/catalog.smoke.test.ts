// Vitest が #rail-catalog-active alias を正しく解決できるかを確認するスモークテスト。
import { describe, it, expect } from "vitest";
import { RAIL_CATALOG } from ".";

describe("RAIL_CATALOG (Vitest alias smoke)", () => {
  it("alias が解決されて stations を持つ", () => {
    expect(RAIL_CATALOG).toBeTruthy();
    expect(Array.isArray(RAIL_CATALOG.stations)).toBe(true);
    expect(RAIL_CATALOG.stations.length).toBeGreaterThan(0);
    expect(Array.isArray(RAIL_CATALOG.lines)).toBe(true);
    expect(RAIL_CATALOG.defaults).toBeTruthy();
  });
});
