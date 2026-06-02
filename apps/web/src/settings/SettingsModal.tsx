import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useAtom } from "jotai";
import { useState } from "react";
import { MASTER_TRAIN_LINES } from "@asamiru/shared";
import type { WatchedLine } from "@asamiru/shared";
import { weatherSettingsAtom } from "./weatherSettingsAtom";
import { trainsSettingsAtom, KEIO_STATIONS } from "./trainsSettingsAtom";
import { ActionButton, SelectInput, SettingField, TextInput } from "./components/FormControls";
import { LineMultiSelect } from "./components/LineMultiSelect";
import { SleepSettingsSection } from "./SleepSettingsSection";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [weather, setWeather] = useAtom(weatherSettingsAtom);
  const [trains, setTrains] = useAtom(trainsSettingsAtom);
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const customLineValidation = validateCustomLine(customName, customUrl, trains.watchedLines);
  const canAddCustomLine = customLineValidation === undefined && customName.trim().length > 0 && customUrl.trim().length > 0;

  function removeCustomLine(yahooUrl: string) {
    setTrains((prev) => ({
      ...prev,
      watchedLines: prev.watchedLines.filter((l) => l.yahooUrl !== yahooUrl),
    }));
  }

  function addCustomLine() {
    const name = customName.trim();
    const normalizedUrl = normalizeYahooTransitInfoUrl(customUrl);
    if (!name || !normalizedUrl || trains.watchedLines.some((l) => l.yahooUrl === normalizedUrl)) return;
    setTrains((prev) => ({ ...prev, watchedLines: [...prev.watchedLines, { name, yahooUrl: normalizedUrl }] }));
    setCustomName("");
    setCustomUrl("");
  }

  const customLines = trains.watchedLines.filter(
    (l) => !MASTER_TRAIN_LINES.some((m) => m.yahooUrl === l.yahooUrl),
  );

  return (
    <Dialog open={open} onClose={onClose} className="relative z-[10000]">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#e8e6df] px-5 py-4 sm:px-7 sm:py-5">
            <DialogTitle className="text-lg font-semibold text-[#1f2024]">設定</DialogTitle>
            <ActionButton onClick={onClose} variant="ghost" className="h-8 w-8 px-0 py-0" aria-label="閉じる">
              ×
            </ActionButton>
          </div>

          <div className="max-h-[80vh] space-y-7 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <section>
              <SectionTitle>天気</SectionTitle>
              <div className="space-y-4">
                <SettingField label="地名（表示用）">
                  <TextInput
                    type="text"
                    value={weather.locationName}
                    onChange={(e) => setWeather((prev) => ({ ...prev, locationName: e.target.value }))}
                    className="w-full"
                  />
                </SettingField>
                <SettingField label="緯度">
                  <TextInput
                    type="number"
                    step="0.0001"
                    value={weather.lat}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) setWeather((prev) => ({ ...prev, lat: v }));
                    }}
                    className="w-full"
                  />
                </SettingField>
                <SettingField label="経度">
                  <TextInput
                    type="number"
                    step="0.0001"
                    value={weather.lon}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) setWeather((prev) => ({ ...prev, lon: v }));
                    }}
                    className="w-full"
                  />
                </SettingField>
              </div>
            </section>

            <section>
              <SectionTitle>電車</SectionTitle>
              <div className="space-y-4">
                <SettingField label="乗車駅">
                  <SelectInput
                    value={trains.boardingStation}
                    onChange={(e) => setTrains((prev) => ({ ...prev, boardingStation: e.target.value }))}
                    className="w-full"
                  >
                    {KEIO_STATIONS.map((station) => (
                      <option key={station} value={station}>{station}</option>
                    ))}
                  </SelectInput>
                </SettingField>
                <SettingField label="表示本数（方向ごと）">
                  <TextInput
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
                    className="w-full"
                  />
                </SettingField>
              </div>
            </section>

            <section>
              <SectionTitle>路線運行情報</SectionTitle>

              <div className="space-y-5">
                <SettingField
                  label="監視する路線"
                  description="路線名で検索して複数選択できます。"
                  wide
                >
                  <LineMultiSelect
                    options={MASTER_TRAIN_LINES}
                    value={trains.watchedLines}
                    onChange={(watchedLines) => setTrains((prev) => ({ ...prev, watchedLines }))}
                  />
                </SettingField>

                {customLines.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-[#9aa0aa]">カスタム路線</div>
                    {customLines.map((line) => (
                      <div key={line.yahooUrl} className="flex items-center justify-between gap-3 rounded-md bg-[#f5f3ee] px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-[#1f2024]">{line.name}</div>
                          <div className="truncate text-xs text-[#9aa0aa]">{line.yahooUrl}</div>
                        </div>
                        <ActionButton
                          onClick={() => removeCustomLine(line.yahooUrl)}
                          variant="danger"
                          className="shrink-0 px-2 py-1"
                          aria-label={`${line.name}を削除`}
                        >
                          削除
                        </ActionButton>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-lg border border-[#e8e6df] p-4">
                  <div className="mb-3 text-xs font-medium text-[#9aa0aa]">カスタム路線を追加</div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(7rem,10rem)_minmax(0,1fr)_auto]">
                    <TextInput
                      type="text"
                      placeholder="路線名"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      className="w-full"
                    />
                    <TextInput
                      type="url"
                      placeholder="https://transit.yahoo.co.jp/diainfo/102/0"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && canAddCustomLine) addCustomLine(); }}
                      invalid={Boolean(customLineValidation)}
                      className="w-full"
                    />
                    <ActionButton
                      onClick={addCustomLine}
                      disabled={!canAddCustomLine}
                      variant="primary"
                      className="sm:self-start"
                    >
                      追加
                    </ActionButton>
                  </div>
                  {customLineValidation ? <div className="mt-2 text-xs text-[#c14b3a]">{customLineValidation}</div> : null}
                  <div className="mt-2 text-xs leading-relaxed text-[#9aa0aa]">
                    Yahoo!路線情報の `https://transit.yahoo.co.jp/diainfo/数字/数字` 形式に対応しています。
                  </div>
                </div>
              </div>
            </section>

            <section>
              <SectionTitle>スリープ</SectionTitle>
              <SleepSettingsSection />
            </section>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[#9aa0aa]">{children}</h3>;
}

function validateCustomLine(name: string, rawUrl: string, watchedLines: WatchedLine[]): string | undefined {
  const hasName = name.trim().length > 0;
  const hasUrl = rawUrl.trim().length > 0;
  if (!hasName && !hasUrl) return undefined;
  if (!hasName) return "路線名を入力してください。";
  if (!hasUrl) return "Yahoo!路線情報のURLを入力してください。";

  const normalizedUrl = normalizeYahooTransitInfoUrl(rawUrl);
  if (!normalizedUrl) return "URLは https://transit.yahoo.co.jp/diainfo/数字/数字 の形式で入力してください。";
  if (watchedLines.some((line) => line.yahooUrl === normalizedUrl)) return "この路線URLはすでに追加されています。";

  return undefined;
}

function normalizeYahooTransitInfoUrl(rawUrl: string): string | undefined {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return undefined;
  }

  const match = url.pathname.match(/^\/diainfo\/(\d+)\/(\d+)\/?$/);
  if (url.protocol !== "https:" || url.hostname !== "transit.yahoo.co.jp" || !match) {
    return undefined;
  }

  return `https://transit.yahoo.co.jp/diainfo/${match[1]}/${match[2]}`;
}
