/** スリープ中の全画面オーバーレイ。黒背景に低輝度の時計のみ（1分粒度）。復帰は window の capture listener が拾う。 */
export function SleepScreen({ now }: { now: number }) {
  const date = new Date(now);
  const hm = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[10001] flex select-none items-center justify-center bg-black">
      <div className="font-mono text-7xl font-light tracking-wide text-white/20 sm:text-8xl lg:text-9xl">
        {hm}
      </div>
    </div>
  );
}
