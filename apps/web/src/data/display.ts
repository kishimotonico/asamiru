import type { DesiredDisplayPower, DisplayEvent, DisplayInfoResponse, DisplayStatus } from "@asamiru/shared";
import { apiEndpoint } from "./apiEndpoint";

const DISPLAY_ENDPOINT = apiEndpoint("/api/system/display");
const DESIRED_POWER_ENDPOINT = apiEndpoint("/api/system/display/desired-power");
const EVENTS_ENDPOINT = apiEndpoint("/api/system/display/events");

export async function fetchDisplayStatus(): Promise<DisplayInfoResponse> {
  const response = await fetch(DISPLAY_ENDPOINT);
  if (!response.ok) {
    throw new Error(`GET /api/system/display returned ${response.status}`);
  }
  return (await response.json()) as DisplayInfoResponse;
}

/** モニターの desired power を送る。失敗してもスリープ自体は失敗させない（呼び出し元で握りつぶす）*/
export async function putDesiredPower(power: DesiredDisplayPower): Promise<void> {
  const response = await fetch(DESIRED_POWER_ENDPOINT, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ power }),
  });
  if (!response.ok) {
    throw new Error(`PUT /api/system/display/desired-power returned ${response.status}`);
  }
}

export type DisplayEventSubscription = {
  /** サブスクリプションを解除する */
  unsubscribe: () => void;
};

/**
 * SSE でモニター状態変化を購読する。
 * 接続が切れると EventSource が自動再接続を試み、onopen のたびに onReconnect が呼ばれる。
 */
export function subscribeDisplayEvents(options: {
  onStatus: (status: DisplayStatus, event: DisplayEvent) => void;
  /** SSE 接続が（再）確立したとき呼ばれる。再同期のため GET で現在状態を取り直す用途 */
  onReconnect: () => void;
}): DisplayEventSubscription {
  const es = new EventSource(EVENTS_ENDPOINT);

  es.onmessage = (e) => {
    try {
      const parsed = JSON.parse(e.data as string) as DisplayEvent;
      options.onStatus(parsed.status, parsed);
    } catch {
      // 不正な JSON は無視
    }
  };

  // 接続確立・再接続のたびに呼ぶ（初回接続も含む）
  es.onopen = () => {
    options.onReconnect();
  };

  return {
    unsubscribe: () => es.close(),
  };
}
