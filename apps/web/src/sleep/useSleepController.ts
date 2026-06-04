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
 * showSleepScreen（受動ゲート）= desiredSleeping || (モニター有効 && 物理OFF)
 * モニターが明示的に OFF のときは、アプリの intent に関わらずスリープ表示にする。
 * intent を書き換えない受動的なゲートであり、wake と競合しない。
 */
export function useSleepController(): { sleeping: boolean; now: number; sleepNow: () => void } {
  const settings = useAtomValue(sleepSettingsAtom);
  const { toggle: toggleFullscreen } = useFullscreen();

  const intent = useSleepIntent(settings);
  const display = useDisplaySync({
    desiredSleeping: intent.desiredSleeping,
    onExternalOn: intent.actions.activity,
    // 物理OFFは forcedSleep として扱う
    onExternalOff: intent.actions.forceSleep,
  });

  /**
   * intent とは独立した受動的な表示ゲート。
   * モニターが物理 OFF の間は intent に関わらず黒画面（on 要求の反映待ち、
   * 再接続時 unknown→off の隙間を埋める安全弁）。
   * intent を書き換えないので wake（activity）と競合しない。
   * 連動無効時は power が常に "unknown" でこの項は効かない。
   */
  const showSleepScreen = intent.desiredSleeping || (display.enabled && display.power === "off");

  useGlobalInput({
    showSleepScreen,
    onActivity: () => {
      intent.actions.activity();
      // displayUnavailable（モニターOFF）でスリープしていた場合、desiredSleeping は既に false で
      // 送信 Effect が再実行されないため、明示的に復帰要求を送る（自動復帰失敗時の再試行手段）。
      if (display.enabled && display.power === "off") display.requestPower("on");
    },
    onManualSleep: intent.actions.forceSleep,
    onToggleFullscreen: toggleFullscreen,
  });

  return { sleeping: showSleepScreen, now: intent.now, sleepNow: intent.actions.forceSleep };
}
