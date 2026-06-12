import { useEffect, useRef, useState } from "react";
import type { DesiredDisplayPower, DisplayPower } from "@asamiru/shared";
import { fetchDisplayStatus, putDesiredPower, subscribeDisplayEvents } from "../data/display";
import { createLogger } from "../lib/logger";
import { connectWithRetry } from "./displayConnectHelper";

const log = createLogger("display");

export type UseDisplaySync = {
  /** モニター連動が有効か（サーバーが enabled を返したか）*/
  enabled: boolean;
  /** 最後に観測したモニター電源 */
  power: DisplayPower;
  /** 明示的に desired power を送る（自動送信が走らないケースの再試行手段）*/
  requestPower: (power: DesiredDisplayPower) => void;
};

export type DisplaySyncCallbacks = {
  /** アプリのスリープ意図。standby/on の自動送信に使う */
  desiredSleeping: boolean;
  /** 物理 ON を検知したとき（ユーザー操作として扱う）*/
  onExternalOn: () => void;
  /** 物理 OFF を検知したとき（ユーザー操作として扱う）*/
  onExternalOff: () => void;
};

/**
 * 物理モニターとの連動を司るフック。
 *
 * - サーバーの desired-power に意図を反映する（standby/on）。観測値と一致するなら送らない。
 * - SSE でモニター状態を購読し、外部操作（powerOrigin=external）をスリープ意図へ橋渡しする。
 * - 切断中の物理操作は、再接続時に最後の観測値との差分で検知する。
 * - マウント時にバックオフ付きリトライで GET を試みる。サーバーが起動前でも自動的に接続を確立する。
 *
 * アプリのスリープ意図そのものは持たない（useSleepIntent の責務）。
 */
export function useDisplaySync({ desiredSleeping, onExternalOn, onExternalOff }: DisplaySyncCallbacks): UseDisplaySync {
  const [enabled, setEnabled] = useState(false);
  const [power, setPower] = useState<DisplayPower>("unknown");

  // ハンドラ（マウント時1度だけ登録）から最新値を読むための ref
  const powerRef = useRef(power);
  powerRef.current = power;
  const onExternalOnRef = useRef(onExternalOn);
  onExternalOnRef.current = onExternalOn;
  const onExternalOffRef = useRef(onExternalOff);
  onExternalOffRef.current = onExternalOff;

  // desired power 送信（desiredSleeping の変化時、および有効化時）。
  // enabled を依存に含めることで、起動時に後から有効化されても現在の意図を同期する。
  useEffect(() => {
    if (!enabled) return;
    const desired: DesiredDisplayPower = desiredSleeping ? "standby" : "on";
    const targetPower: DisplayPower = desired === "standby" ? "off" : "on";
    if (powerRef.current === targetPower) return; // skip-if-matches
    putDesiredPower(desired).catch((err) => {
      // モニター制御失敗はスリープを失敗させない
      log.warn("putDesiredPower failed:", err);
    });
  }, [desiredSleeping, enabled]);

  // SSE 購読・初回同期（マウント時1度だけ、バックオフ付きリトライ）
  useEffect(() => {
    const cancelled = { value: false };
    // connectWithRetry が resolve したあと unsubscribe を保持するためのコンテナ。
    // アンマウントが connectWithRetry の resolve より先に起きた場合は cancelled.value=true に
    // なっているため subscribe は呼ばれず、unsubscribe は no-op になる。
    const cleanupRef = { fn: () => undefined as void };

    const applyExternalPower = (next: DisplayPower) => {
      if (next === "off") onExternalOffRef.current();
      else if (next === "on") onExternalOnRef.current();
    };

    // 再接続時の再同期。切断中の物理操作を、最後に観測した power との差分で検知する
    // （瞬間値の powerOrigin には頼らない）。
    async function reconcile() {
      try {
        const info = await fetchDisplayStatus();
        if (!info.enabled) return;
        const prev = powerRef.current;
        setPower(info.power);
        if (prev !== "unknown" && info.power !== "unknown" && info.power !== prev) {
          applyExternalPower(info.power);
        }
      } catch (err) {
        log.warn("fetchDisplayStatus failed:", err);
      }
    }

    // connectWithRetry を起動。
    // cancelled フラグが true のうちは onConnected / subscribe は呼ばれない。
    void connectWithRetry(
      cancelled,
      {
        fetchStatus: fetchDisplayStatus,
        subscribe: (cbs) => {
          log.info("subscribing to monitor events");
          return subscribeDisplayEvents({
            onStatus: (status) => {
              log.info(`event power=${status.power} origin=${status.powerOrigin} connection=${status.connection}`);
              setPower(status.power);
              if (status.powerOrigin === "external") {
                log.info(`applying external power=${status.power}`);
                cbs.onStatus(status.power, status.powerOrigin);
              }
            },
            onReconnect: () => {
              log.info("monitor event stream connected");
              cbs.onReconnect();
            },
          });
        },
        onConnected: (initialPower) => {
          log.info(`initial status power=${initialPower}`);
          setEnabled(true);
          setPower(initialPower);
        },
        onRetry: (err, backoffMs) => {
          log.warn(`fetchDisplayStatus failed, retrying in ${backoffMs}ms:`, err);
        },
        onDisabled: () => {
          log.info("monitor integration is disabled");
        },
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      },
      {
        onStatus: (power) => {
          applyExternalPower(power as DisplayPower);
        },
        onReconnect: () => {
          void reconcile();
        },
      },
    ).then((unsubscribe) => {
      cleanupRef.fn = unsubscribe;
    });

    return () => {
      cancelled.value = true;
      cleanupRef.fn();
    };
    // マウント時だけ実行（ref経由で最新値を読むため依存配列は空でよい）
  }, []);

  const requestPower = (next: DesiredDisplayPower) => {
    if (!enabled) return;
    putDesiredPower(next).catch((err) => {
      log.warn("putDesiredPower failed:", err);
    });
  };

  return { enabled, power, requestPower };
}
