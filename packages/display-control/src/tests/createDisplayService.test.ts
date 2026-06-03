import { describe, it, expect, vi } from "vitest";
import { createDisplayService } from "../createDisplayService.js";

describe("createDisplayService", () => {
  it("enabled=false で driver が一切呼ばれない", async () => {
    const svc = createDisplayService({ enabled: false });
    await svc.start();
    // NullService は start/stop を空で処理し、ハードウェアアクセスをしない
    expect(svc.enabled).toBe(false);
    expect(svc.getStatus()).toBeNull();
    svc.stop();
  });

  it("enabled=false で setDesiredPower が not_enabled エラーを投げる", async () => {
    const svc = createDisplayService({ enabled: false });
    await expect(svc.setDesiredPower("standby")).rejects.toMatchObject({
      code: "not_enabled",
    });
  });

  it("enabled=true driver=fake でサービスが起動できる", async () => {
    const svc = createDisplayService({
      enabled: true,
      driver: "fake",
      connector: "HDMI-A-1",
    });
    await svc.start();
    expect(svc.enabled).toBe(true);
    expect(svc.getStatus()).not.toBeNull();
    svc.stop();
  });

  it("enabled=true driver=ddc-ci で ddcBus 未指定ならエラーをスロー", () => {
    expect(() =>
      createDisplayService({
        enabled: true,
        driver: "ddc-ci",
        connector: "HDMI-A-1",
        ddcBus: undefined,
      }),
    ).toThrow(/ASAMIRU_DDC_BUS/);
  });

  it("enabled=true driver=fake の simulateExternal が subscribe コールバックを呼ぶ", async () => {
    const svc = createDisplayService({
      enabled: true,
      driver: "fake",
      connector: "HDMI-A-1",
    });
    const events: Array<{ power: string; origin: string }> = [];
    svc.subscribe((e) => events.push({ power: e.status.power, origin: e.status.powerOrigin }));
    await svc.start();

    if (!svc.enabled) throw new Error("expected enabled service");
    svc.simulateExternal("off");
    await new Promise((r) => setTimeout(r, 10)); // キュー経由の反映を待つ

    expect(events.some((e) => e.power === "off" && e.origin === "external")).toBe(true);
    svc.stop();
  });
});
