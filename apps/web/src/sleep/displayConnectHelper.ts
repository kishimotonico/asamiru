import type { DisplayInfoResponse, DisplayPower } from "@asamiru/shared";
import type { DisplayEventSubscription } from "../data/display";

/** バックオフの初期値（ms）。サーバー側 UDEV_BACKOFF_INITIAL_MS と揃える */
export const BACKOFF_INITIAL_MS = 1_000;
/** バックオフの上限（ms）。サーバー側 UDEV_BACKOFF_MAX_MS と揃える */
export const BACKOFF_MAX_MS = 30_000;

export type SubscribeCallbacks = {
  onStatus: (power: DisplayPower, powerOrigin: string) => void;
  onReconnect: () => void;
};

export type ConnectHelperCallbacks = {
  /** fetchDisplayStatus の代替（テスト時に差し替え可能） */
  fetchStatus: () => Promise<DisplayInfoResponse>;
  /**
   * subscribeDisplayEvents の代替（テスト時に差し替え可能）。
   * GET が {enabled:true} で成功したあと1回だけ呼ばれる。
   */
  subscribe: (callbacks: SubscribeCallbacks) => DisplayEventSubscription;
  /**
   * GET が {enabled:true} で成功したときに呼ばれる。
   * enabled=true のセットと初回 power のセットを行う。
   */
  onConnected: (power: DisplayPower) => void;
  /** リトライ前のバックオフ待機ログ用コールバック */
  onRetry: (err: unknown, backoffMs: number) => void;
  /** {enabled:false} 終端のログ用コールバック */
  onDisabled: () => void;
  /** sleep(ms) の実装（テスト時に fake timer で置き換え可能） */
  sleep: (ms: number) => Promise<void>;
};

/**
 * モニター連動の初期接続フロー。React に依存しない pure helper。
 *
 * - fetchStatus() で GET を試みる。
 * - {enabled:false} なら onDisabled() を呼んで終端（無効確定、リトライなし）。
 * - {enabled:true} なら onConnected(power) を呼び、subscribe() で SSE 購読を開始して終端。
 * - catch 時はバックオフして再試行する。
 * - cancelled.value が true になったらいつでも停止する
 *   （onConnected / subscribe は cancelled.value === false のときだけ呼ぶ）。
 *
 * GET 成功後の SSE 接続失敗は EventSource の自動再接続に委ねる（GET ループへは戻さない）。
 *
 * @returns cleanup 関数。subscribe が完了している場合はその unsubscribe、未完了なら no-op。
 */
export async function connectWithRetry(
  cancelled: { value: boolean },
  callbacks: ConnectHelperCallbacks,
  subscribeCallbacks: SubscribeCallbacks,
): Promise<() => void> {
  let backoffMs = BACKOFF_INITIAL_MS;
  let subscription: DisplayEventSubscription | null = null;

  while (!cancelled.value) {
    try {
      const info = await callbacks.fetchStatus();

      // fetch の await 中に unmount された場合は何もしない
      if (cancelled.value) break;

      if (!info.enabled) {
        callbacks.onDisabled();
        break; // 無効確定、リトライしない
      }

      // GET 成功: state 更新
      callbacks.onConnected(info.power);

      // onConnected 後に unmount された場合は subscribe しない
      if (cancelled.value) break;

      subscription = callbacks.subscribe(subscribeCallbacks);
      break; // 成功で終端
    } catch (err) {
      if (cancelled.value) break;

      callbacks.onRetry(err, backoffMs);
      await callbacks.sleep(backoffMs);
      backoffMs = Math.min(backoffMs * 2, BACKOFF_MAX_MS);
    }
  }

  return () => {
    subscription?.unsubscribe();
  };
}
