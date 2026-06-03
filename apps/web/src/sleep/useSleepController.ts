import { useAtomValue } from "jotai";
import { sleepSettingsAtom } from "./sleepSettingsAtom";
import { useFullscreen } from "./useFullscreen";
import { useSleepIntent } from "./useSleepIntent";
import { useDisplaySync } from "./useDisplaySync";
import { useGlobalInput } from "./useGlobalInput";

/**
 * スリープ機能を統括する hook。App に1つだけマウントする。
 * 3つの責務を合成するだけの薄い層に保つ:
 *
 * - useSleepIntent : アプリのスリープ意図（スケジュール・一時起床・手動スリープ）
 * - useDisplaySync : 物理モニター連動（desired power 送信・外部ON/OFFの取り込み）
 * - useGlobalInput : キーボード・ポインタ・ダブルクリック操作
 *
 * effectiveSleeping = desiredSleeping || (モニター有効 && 物理OFF)
 * モニターが明示的に OFF のときは、アプリの意図に関わらずスリープ表示にする。
 */
export function useSleepController(): { sleeping: boolean; now: number; sleepNow: () => void } {
  const settings = useAtomValue(sleepSettingsAtom);
  const { toggle: toggleFullscreen } = useFullscreen();

  const intent = useSleepIntent(settings);
  const display = useDisplaySync({
    desiredSleeping: intent.desiredSleeping,
    onExternalOn: intent.actions.wake,
    onExternalOff: intent.actions.manualSleep,
  });

  // モニターが明示的にOFFなら意図に関わらずスリープ扱い（無効時は power=unknown なので影響しない）
  const effectiveSleeping = intent.desiredSleeping || (display.enabled && display.power === "off");

  useGlobalInput({
    effectiveSleeping,
    onWake: () => {
      intent.actions.wake();
      // displayUnavailable（モニターOFF）でスリープしていた場合、desiredSleeping は既に false で
      // 送信 Effect が再実行されないため、明示的に復帰要求を送る（自動復帰失敗時の再試行手段）。
      if (display.enabled && display.power === "off") display.requestPower("on");
    },
    onExtend: intent.actions.extend,
    onManualSleep: intent.actions.manualSleep,
    onToggleFullscreen: toggleFullscreen,
  });

  return { sleeping: effectiveSleeping, now: intent.now, sleepNow: intent.actions.manualSleep };
}
