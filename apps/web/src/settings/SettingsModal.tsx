import { useAtom } from "jotai";
import { useRef, useEffect, useState } from "react";
import { MASTER_TRAIN_LINES } from "@asamiru/shared";
import type { WatchedLine } from "@asamiru/shared";
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
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  function isWatched(yahooUrl: string) {
    return trains.watchedLines.some((l) => l.yahooUrl === yahooUrl);
  }

  function togglePreset(line: WatchedLine) {
    setTrains((prev) => ({
      ...prev,
      watchedLines: isWatched(line.yahooUrl)
        ? prev.watchedLines.filter((l) => l.yahooUrl !== line.yahooUrl)
        : [...prev.watchedLines, line],
    }));
  }

  function removeCustomLine(yahooUrl: string) {
    setTrains((prev) => ({
      ...prev,
      watchedLines: prev.watchedLines.filter((l) => l.yahooUrl !== yahooUrl),
    }));
  }

  function addCustomLine() {
    const name = customName.trim();
    const url = customUrl.trim();
    if (!name || !url) return;
    if (trains.watchedLines.some((l) => l.yahooUrl === url)) return;
    setTrains((prev) => ({ ...prev, watchedLines: [...prev.watchedLines, { name, yahooUrl: url }] }));
    setCustomName("");
    setCustomUrl("");
  }

  const customLines = trains.watchedLines.filter(
    (l) => !MASTER_TRAIN_LINES.some((m) => m.yahooUrl === l.yahooUrl),
  );

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

      <div className="max-h-[80vh] space-y-7 overflow-y-auto px-7 py-6">
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
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setWeather((prev) => ({ ...prev, lat: v }));
                }}
                className="w-40 rounded-md border border-[#d4d1c9] px-3 py-1.5 text-sm text-[#1f2024] focus:border-[--accent] focus:outline-none"
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#1f2024]">経度</span>
              <input
                type="number"
                step="0.0001"
                value={weather.lon}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v)) setWeather((prev) => ({ ...prev, lon: v }));
                }}
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
                id="displayCount"
                name="displayCount"
                min={1}
                max={10}
                value={trains.displayCount}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (v >= 1) setTrains((prev) => ({ ...prev, displayCount: v }));
                }}
                className="w-20 rounded-md border border-[#d4d1c9] px-3 py-1.5 text-sm text-[#1f2024] focus:border-[--accent] focus:outline-none"
              />
            </label>
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#9aa0aa]">路線運行情報</h3>

          <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2.5">
            {MASTER_TRAIN_LINES.map((line) => (
              <label key={line.yahooUrl} className="flex cursor-pointer items-center gap-2 text-sm text-[#1f2024]">
                <input
                  type="checkbox"
                  checked={isWatched(line.yahooUrl)}
                  onChange={() => togglePreset(line)}
                  className="accent-[--accent]"
                />
                {line.name}
              </label>
            ))}
          </div>

          {customLines.length > 0 && (
            <div className="mb-3 space-y-1.5">
              <div className="text-xs text-[#9aa0aa]">カスタム路線</div>
              {customLines.map((line) => (
                <div key={line.yahooUrl} className="flex items-center justify-between rounded-md bg-[#f5f3ee] px-3 py-2 text-sm">
                  <span className="text-[#1f2024]">{line.name}</span>
                  <button
                    onClick={() => removeCustomLine(line.yahooUrl)}
                    className="text-[#9aa0aa] hover:text-[#c14b3a]"
                    aria-label={`${line.name}を削除`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="路線名"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="w-28 rounded-md border border-[#d4d1c9] px-3 py-1.5 text-sm text-[#1f2024] focus:border-[--accent] focus:outline-none"
            />
            <input
              type="url"
              placeholder="Yahoo Transit URL"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addCustomLine(); }}
              className="min-w-0 flex-1 rounded-md border border-[#d4d1c9] px-3 py-1.5 text-sm text-[#1f2024] focus:border-[--accent] focus:outline-none"
            />
            <button
              onClick={addCustomLine}
              disabled={!customName.trim() || !customUrl.trim()}
              className="shrink-0 rounded-md bg-[--accent] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              追加
            </button>
          </div>
        </section>
      </div>
    </dialog>
  );
}
