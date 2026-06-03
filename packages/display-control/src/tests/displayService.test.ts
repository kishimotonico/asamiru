import { describe, it, expect, vi, beforeEach } from "vitest";
import { FakeDisplayDriver } from "../fakeDisplayDriver.js";
import { DisplayService } from "../displayService.js";
import type { DisplayEvent } from "@asamiru/shared";

const DEFAULT_CAPS = {
  canReadConnection: true,
  canReadPower: true,
  canSetPowerOn: true,
  canSetStandby: true,
};

function makeService(driver: FakeDisplayDriver) {
  return new DisplayService(driver, { connector: "HDMI-A-1", capabilities: DEFAULT_CAPS });
}

async function startAndInitial(service: DisplayService): Promise<DisplayEvent[]> {
  const events: DisplayEvent[] = [];
  service.subscribe((e) => events.push(e));
  await service.start();
  return events;
}

/** キュー経由の非同期処理が反映されるのを待つ */
function tick(ms = 10): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe("DisplayService", () => {
  let driver: FakeDisplayDriver;
  let service: DisplayService;

  beforeEach(() => {
    driver = new FakeDisplayDriver("on");
    service = makeService(driver);
  });

  it("① コマンド由来の遷移は powerOrigin=command で external を出さない", async () => {
    const events = await startAndInitial(service);

    await service.setDesiredPower("standby");
    service.stop();

    // commandPhase=commanding または settling の間の snapshot は powerOrigin=command
    const afterCommand = events.filter((e) => e.trigger === "command-confirmation");
    expect(afterCommand.length).toBeGreaterThan(0);
    for (const e of afterCommand) {
      expect(e.status.powerOrigin).toBe("command");
    }
  });

  it("② simulateExternal('off') で external off を配信", async () => {
    const events = await startAndInitial(service);

    driver.simulateExternal("off");
    await tick(); // キュー経由の反映を待つ
    service.stop();

    const externalOff = events.filter(
      (e) => e.status.powerOrigin === "external" && e.status.power === "off",
    );
    expect(externalOff.length).toBeGreaterThan(0);
  });

  it("③ simulateExternal('on') で external on を配信", async () => {
    driver = new FakeDisplayDriver("off");
    service = makeService(driver);
    const events = await startAndInitial(service);

    driver.simulateExternal("on");
    await tick(); // キュー経由の反映を待つ
    service.stop();

    const externalOn = events.filter(
      (e) => e.status.powerOrigin === "external" && e.status.power === "on",
    );
    expect(externalOn.length).toBeGreaterThan(0);
  });

  it("④ skip-if-matches: 観測値と目標が一致する場合 DDC コマンドを送らない", async () => {
    await startAndInitial(service);

    const setStandbySpy = vi.spyOn(driver, "setStandby");
    const setPowerOnSpy = vi.spyOn(driver, "setPowerOn");

    // power=on の状態で desired=on を送る → コマンド不送出
    await service.setDesiredPower("on");
    expect(setPowerOnSpy).not.toHaveBeenCalled();

    // power=on の状態で desired=standby を送る → コマンド送出
    await service.setDesiredPower("standby");
    expect(setStandbySpy).toHaveBeenCalledOnce();

    service.stop();
  });

  it("⑤ external 変化が連続していないと OFF は確定しない（単発 unknown は無視）", async () => {
    // readPower が最初 unknown を返してから off を返す場合、1回では確定しない
    const readPowerResults = [
      { power: "unknown" as const, error: "display_not_found: x" },
      { power: "off" as const, error: null },
    ];
    let callCount = 0;
    vi.spyOn(driver, "readPower").mockImplementation(async () => {
      const result = readPowerResults[callCount] ?? readPowerResults.at(-1)!;
      callCount += 1;
      return result;
    });

    const events = await startAndInitial(service);
    service.stop();

    // 最初の initial snapshot では power は unknown のまま（単発 off では確定しない）
    const initialEvent = events.find((e) => e.trigger === "initial");
    expect(initialEvent?.status.power).toBe("unknown");
  });

  it("⑥ 初回観測（initial）は power=on でも external 扱いにしない", async () => {
    // 起動時にモニターが既に on の場合、起動しただけで external（物理ON操作）と誤判定しない
    const events = await startAndInitial(service);
    service.stop();

    const initialEvent = events.find((e) => e.trigger === "initial");
    expect(initialEvent?.status.power).toBe("on");
    expect(initialEvent?.status.powerOrigin).toBe("unknown");
    // initial 由来で external イベントが一切出ていないこと
    expect(events.every((e) => e.status.powerOrigin !== "external")).toBe(true);
  });

  it("⑦ DDC コマンド失敗時は setDesiredPower が reject する", async () => {
    await startAndInitial(service);

    vi.spyOn(driver, "setStandby").mockRejectedValue(new Error("ddcutil failed: permission denied"));

    await expect(service.setDesiredPower("standby")).rejects.toThrow(/permission denied/);
    // エラーが status に記録される
    expect(service.getStatus().error?.code).toBe("ddc_failed");

    service.stop();
  });

  it("⑧ DDC アクセスは直列化される（poll とコマンドが重ならない）", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;
    const track = async <T>(fn: () => T): Promise<T> => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 5));
      concurrent -= 1;
      return fn();
    };
    vi.spyOn(driver, "readPower").mockImplementation(() => track(() => ({ power: "on" as const, error: null })));
    vi.spyOn(driver, "readConnection").mockImplementation(() =>
      track(() => ({ connection: "connected" as const, error: null })),
    );
    vi.spyOn(driver, "setStandby").mockImplementation(() => track(() => undefined));

    await startAndInitial(service);
    // コマンドと複数 snapshot を同時に投げても直列化されること
    await Promise.all([
      service.setDesiredPower("standby"),
      service.setDesiredPower("on"),
      service.setDesiredPower("standby"),
    ]);
    service.stop();

    // readConnection と readPower は同じ observe 内で並行（Promise.allSettled）するため最大2。
    // 異なるタスク（poll/command）が重なって 3 以上になっていないこと。
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
