import { useAtom } from "jotai";
import { useState } from "react";
import { MASTER_TRAIN_LINES } from "@asamiru/shared";
import type { WatchedLine } from "@asamiru/shared";
import { trainsSettingsAtom } from "./trainsSettingsAtom";
import { ActionButton, SettingField, TextInput } from "./components/FormControls";
import { LineMultiSelect } from "./components/LineMultiSelect";

export function LineStatusSettingsSection() {
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
          <div className="text-xs font-medium text-ink-subtle">カスタム路線</div>
          {customLines.map((line) => (
            <div key={line.yahooUrl} className="flex items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium text-ink">{line.name}</div>
                <div className="truncate text-xs text-ink-subtle">{line.yahooUrl}</div>
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

      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 text-xs font-medium text-ink-subtle">カスタム路線を追加</div>
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
        {customLineValidation ? <div className="mt-2 text-xs text-danger">{customLineValidation}</div> : null}
        <div className="mt-2 text-xs leading-relaxed text-ink-subtle">
          Yahoo!路線情報の `https://transit.yahoo.co.jp/diainfo/数字/数字` 形式に対応しています。
        </div>
      </div>
    </div>
  );
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
