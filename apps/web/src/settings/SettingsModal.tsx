import { useAtom } from "jotai";
import { useRef, useEffect } from "react";
import { watchedTrainLines } from "@asamiru/shared";
import { weatherSettingsAtom } from "./weatherSettingsAtom";
import { trainsSettingsAtom, KEIO_STATIONS } from "./trainsSettingsAtom";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [weather, setWeather] = useAtom(weatherSettingsAtom);
  const [trains, setTrains] = useAtom(trainsSettingsAtom);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  function toggleLine(id: string) {
    setTrains((prev) => ({
      ...prev,
      watchedLineIds: prev.watchedLineIds.includes(id)
        ? prev.watchedLineIds.filter((l) => l !== id)
        : [...prev.watchedLineIds, id],
    }));
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-lg rounded-xl bg-white p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-[#e8e6df] px-7 py-5">
        <h2 className="text-lg font-semibold text-[#1f2024]">設定</h2>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#9aa0aa] hover:bg-[#f5f3ee] hover:text-[#1f2024]"
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>

      <div className="space-y-7 px-7 py-6">
        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#9aa0aa]">天気</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#1f2024]">地名（表示用）</span>
              <input
                type="text"
                value={weather.locationName}
                onChange={(e) => setWeather((prev) => ({ ...prev, locationName: e.target.value }))}
                className="w-40 rounded-md border border-[#d4d1c9] px-3 py-1.5 text-sm text-[#1f2024] focus:border-[--accent] focus:outline-none"
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#1f2024]">緯度</span>
              <input
                type="number"
                step="0.0001"
                value={weather.lat}
                onChange={(e) => setWeather((prev) => ({ ...prev, lat: Number(e.target.value) }))}
                className="w-40 rounded-md border border-[#d4d1c9] px-3 py-1.5 text-sm text-[#1f2024] focus:border-[--accent] focus:outline-none"
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#1f2024]">経度</span>
              <input
                type="number"
                step="0.0001"
                value={weather.lon}
                onChange={(e) => setWeather((prev) => ({ ...prev, lon: Number(e.target.value) }))}
                className="w-40 rounded-md border border-[#d4d1c9] px-3 py-1.5 text-sm text-[#1f2024] focus:border-[--accent] focus:outline-none"
              />
            </label>
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#9aa0aa]">電車</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#1f2024]">乗車駅</span>
              <select
                value={trains.boardingStation}
                onChange={(e) => setTrains((prev) => ({ ...prev, boardingStation: e.target.value }))}
                className="w-40 rounded-md border border-[#d4d1c9] px-3 py-1.5 text-sm text-[#1f2024] focus:border-[--accent] focus:outline-none"
              >
                {KEIO_STATIONS.map((station) => (
                  <option key={station} value={station}>{station}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#1f2024]">表示本数（方向ごと）</span>
              <input
                type="number"
                min={1}
                max={10}
                value={trains.displayCount}
                onChange={(e) => setTrains((prev) => ({ ...prev, displayCount: Math.max(1, Number(e.target.value)) }))}
                className="w-20 rounded-md border border-[#d4d1c9] px-3 py-1.5 text-sm text-[#1f2024] focus:border-[--accent] focus:outline-none"
              />
            </label>
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#9aa0aa]">路線運行情報</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2.5">
            {watchedTrainLines.map((line) => (
              <label key={line.id} className="flex cursor-pointer items-center gap-2 text-sm text-[#1f2024]">
                <input
                  type="checkbox"
                  checked={trains.watchedLineIds.includes(line.id)}
                  onChange={() => toggleLine(line.id)}
                  className="accent-[--accent]"
                />
                {line.name}
              </label>
            ))}
          </div>
        </section>
      </div>
    </dialog>
  );
}
