import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKOFF_INITIAL_MS, BACKOFF_MAX_MS, connectWithRetry } from "./displayConnectHelper";
import type { ConnectHelperCallbacks, SubscribeCallbacks } from "./displayConnectHelper";
import type { DisplayInfoResponse, DisplayPower } from "@asamiru/shared";
import type { DisplayEventSubscription } from "../data/display";

// --- テスト用ユーティリティ ---

/** マイクロタスクキューを複数回 flush する（Promise チェーンを安定させる） */
async function flushMicrotasks(n = 5) {
  for (let i = 0; i < n; i++) {
    await Promise.resolve();
  }
}

function makeSubscribeCallbacks(): SubscribeCallbacks {
  return {
    onStatus: vi.fn(),
    onReconnect: vi.fn(),
  };
}

function makeFakeSubscribe(unsubscribe: () => void = vi.fn()): {
  subscribe: ConnectHelperCallbacks["subscribe"];
  subscribeCalled: () => boolean;
  unsubscribe: () => void;
} {
  let called = false;
  const sub: DisplayEventSubscription = { unsubscribe };
  return {
    subscribe: vi.fn(() => {
      called = true;
      return sub;
    }),
    subscribeCalled: () => called,
    unsubscribe,
  };
}

function makeSleep(): {
  sleep: ConnectHelperCallbacks["sleep"];
  advance: (ms: number) => Promise<void>;
} {
  return {
    sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    advance: async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
    },
  };
}

// enabled=true のレスポンスを作るヘルパー
function enabledResponse(power: DisplayPower = "on"): DisplayInfoResponse {
  return {
    enabled: true,
    connector: "HDMI-A-1",
    connection: "connected",
    power,
    powerOrigin: "command",
    desiredPower: null,
    commandPhase: "idle",
    capabilities: { canReadConnection: true, canReadPower: true, canSetPowerOn: true, canSetStandby: true },
    lastObservedAt: null,
    lastCommandAt: null,
    error: null,
  };
}

const disabledResponse: DisplayInfoResponse = { enabled: false };

// --- テスト ---

describe("connectWithRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("初回 fetch 成功（enabled=true）で onConnected と subscribe が呼ばれる", async () => {
    const onConnected = vi.fn();
    const { subscribe, subscribeCalled } = makeFakeSubscribe();
    const cancelled = { value: false };

    const callbacks: ConnectHelperCallbacks = {
      fetchStatus: vi.fn().mockResolvedValue(enabledResponse("on")),
      subscribe,
      onConnected,
      onRetry: vi.fn(),
      onDisabled: vi.fn(),
      sleep: makeSleep().sleep,
    };

    const cleanupPromise = connectWithRetry(cancelled, callbacks, makeSubscribeCallbacks());
    await vi.runAllTimersAsync();
    await flushMicrotasks();
    await cleanupPromise;

    expect(onConnected).toHaveBeenCalledWith("on");
    expect(subscribeCalled()).toBe(true);
  });

  it("初回 fetch 失敗 → 1s 後にリトライ → 成功で enabled=true と subscribe", async () => {
    const onConnected = vi.fn();
    const onRetry = vi.fn();
    const { subscribe, subscribeCalled } = makeFakeSubscribe();
    const cancelled = { value: false };

    const fetchStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValue(enabledResponse("on"));

    const { sleep, advance } = makeSleep();

    const callbacks: ConnectHelperCallbacks = {
      fetchStatus,
      subscribe,
      onConnected,
      onRetry,
      onDisabled: vi.fn(),
      sleep,
    };

    const cleanupPromise = connectWithRetry(cancelled, callbacks, makeSubscribeCallbacks());

    // 1回目の fetch（失敗）を進める
    await flushMicrotasks();
    // onRetry が呼ばれていること
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), BACKOFF_INITIAL_MS);
    // subscribe はまだ呼ばれていない
    expect(subscribeCalled()).toBe(false);

    // バックオフの 1s を進める
    await advance(BACKOFF_INITIAL_MS);
    await flushMicrotasks();

    await cleanupPromise;

    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(onConnected).toHaveBeenCalledWith("on");
    expect(subscribeCalled()).toBe(true);
  });

  it("複数回失敗でバックオフが指数的に増加する", async () => {
    const onRetry = vi.fn();
    const { subscribe } = makeFakeSubscribe();
    const cancelled = { value: false };

    // 3回失敗してから成功
    const fetchStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue(enabledResponse());

    const { sleep, advance } = makeSleep();

    const callbacks: ConnectHelperCallbacks = {
      fetchStatus,
      subscribe,
      onConnected: vi.fn(),
      onRetry,
      onDisabled: vi.fn(),
      sleep,
    };

    const cleanupPromise = connectWithRetry(cancelled, callbacks, makeSubscribeCallbacks());

    // 1回目失敗
    await flushMicrotasks();
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1_000);

    // 1s バックオフ → 2回目失敗
    await advance(1_000);
    await flushMicrotasks();
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2_000);

    // 2s バックオフ → 3回目失敗
    await advance(2_000);
    await flushMicrotasks();
    expect(onRetry).toHaveBeenNthCalledWith(3, expect.any(Error), 4_000);

    // 4s バックオフ → 成功
    await advance(4_000);
    await flushMicrotasks();

    await cleanupPromise;
    expect(fetchStatus).toHaveBeenCalledTimes(4);
  });

  it("バックオフが BACKOFF_MAX_MS（30s）を超えない", async () => {
    const onRetry = vi.fn();
    const { subscribe } = makeFakeSubscribe();
    const cancelled = { value: false };

    // 6回失敗してから成功
    const fetchStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail")) // → 1s
      .mockRejectedValueOnce(new Error("fail")) // → 2s
      .mockRejectedValueOnce(new Error("fail")) // → 4s
      .mockRejectedValueOnce(new Error("fail")) // → 8s
      .mockRejectedValueOnce(new Error("fail")) // → 16s
      .mockRejectedValueOnce(new Error("fail")) // → 30s（上限）
      .mockResolvedValue(enabledResponse());

    const { sleep, advance } = makeSleep();

    const callbacks: ConnectHelperCallbacks = {
      fetchStatus,
      subscribe,
      onConnected: vi.fn(),
      onRetry,
      onDisabled: vi.fn(),
      sleep,
    };

    const cleanupPromise = connectWithRetry(cancelled, callbacks, makeSubscribeCallbacks());

    const backoffs = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];
    for (const [i, ms] of backoffs.entries()) {
      await flushMicrotasks();
      expect(onRetry).toHaveBeenNthCalledWith(i + 1, expect.any(Error), ms);
      await advance(ms);
    }

    // 最後の fetch（成功）を進める
    await flushMicrotasks();
    await cleanupPromise;

    // 上限が BACKOFF_MAX_MS であること
    expect(onRetry).toHaveBeenLastCalledWith(expect.any(Error), BACKOFF_MAX_MS);
  });

  it("{enabled:false} はリトライせず終端する", async () => {
    const onDisabled = vi.fn();
    const onConnected = vi.fn();
    const { subscribe, subscribeCalled } = makeFakeSubscribe();
    const cancelled = { value: false };

    const callbacks: ConnectHelperCallbacks = {
      fetchStatus: vi.fn().mockResolvedValue(disabledResponse),
      subscribe,
      onConnected,
      onRetry: vi.fn(),
      onDisabled,
      sleep: makeSleep().sleep,
    };

    const cleanupPromise = connectWithRetry(cancelled, callbacks, makeSubscribeCallbacks());
    await vi.runAllTimersAsync();
    await flushMicrotasks();
    await cleanupPromise;

    expect(onDisabled).toHaveBeenCalledOnce();
    expect(onConnected).not.toHaveBeenCalled();
    expect(subscribeCalled()).toBe(false);
  });

  it("unmount/cancel 後に fetch が resolve しても onConnected・subscribe が走らない", async () => {
    const onConnected = vi.fn();
    const { subscribe, subscribeCalled } = makeFakeSubscribe();
    const cancelled = { value: false };

    // fetch が返る前に cancel する
    let resolveFetch!: (value: DisplayInfoResponse) => void;
    const fetchStatus = vi.fn().mockReturnValue(
      new Promise<DisplayInfoResponse>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const callbacks: ConnectHelperCallbacks = {
      fetchStatus,
      subscribe,
      onConnected,
      onRetry: vi.fn(),
      onDisabled: vi.fn(),
      sleep: makeSleep().sleep,
    };

    const cleanupPromise = connectWithRetry(cancelled, callbacks, makeSubscribeCallbacks());

    // fetch がまだ pending の状態でキャンセル
    cancelled.value = true;

    // fetch を resolve させる
    resolveFetch(enabledResponse("on"));
    await vi.runAllTimersAsync();
    await flushMicrotasks();
    await cleanupPromise;

    // cancelled だったので onConnected と subscribe は呼ばれない
    expect(onConnected).not.toHaveBeenCalled();
    expect(subscribeCalled()).toBe(false);
  });

  it("cancel 後のバックオフ中は sleep を抜けてもループしない", async () => {
    const onConnected = vi.fn();
    const onRetry = vi.fn();
    const { subscribe, subscribeCalled } = makeFakeSubscribe();
    const cancelled = { value: false };

    const fetchStatus = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue(enabledResponse());

    const { sleep, advance } = makeSleep();

    const callbacks: ConnectHelperCallbacks = {
      fetchStatus,
      subscribe,
      onConnected,
      onRetry,
      onDisabled: vi.fn(),
      sleep,
    };

    const cleanupPromise = connectWithRetry(cancelled, callbacks, makeSubscribeCallbacks());

    // 1回目失敗 → バックオフ待機中にキャンセル
    await flushMicrotasks();
    expect(onRetry).toHaveBeenCalledOnce();

    cancelled.value = true;

    // バックオフが明けても次の fetch は起きない
    await advance(BACKOFF_INITIAL_MS);
    await flushMicrotasks();

    await cleanupPromise;

    // 2回目の fetch は呼ばれない
    expect(fetchStatus).toHaveBeenCalledOnce();
    expect(onConnected).not.toHaveBeenCalled();
    expect(subscribeCalled()).toBe(false);
  });

  it("成功後の cleanup を呼ぶと unsubscribe が実行される", async () => {
    const unsubscribe = vi.fn();
    const { subscribe } = makeFakeSubscribe(unsubscribe);
    const cancelled = { value: false };

    const callbacks: ConnectHelperCallbacks = {
      fetchStatus: vi.fn().mockResolvedValue(enabledResponse()),
      subscribe,
      onConnected: vi.fn(),
      onRetry: vi.fn(),
      onDisabled: vi.fn(),
      sleep: makeSleep().sleep,
    };

    const cleanup = await connectWithRetry(cancelled, callbacks, makeSubscribeCallbacks());
    await vi.runAllTimersAsync();
    await flushMicrotasks();

    cleanup();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
