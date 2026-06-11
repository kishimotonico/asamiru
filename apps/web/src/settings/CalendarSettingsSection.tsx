import { useState } from "react";
import { useAtom } from "jotai";
import { calendarSettingsAtom } from "./calendarSettingsAtom";
import { ActionButton, SettingField, TextInput } from "./components/FormControls";

const MAX_CALENDARS = 3;

export function CalendarSettingsSection() {
  const [settings, setSettings] = useAtom(calendarSettingsAtom);
  const [newUrl, setNewUrl] = useState("");
  const [error, setError] = useState<string>();

  const addUrl = () => {
    const url = newUrl.trim();
    if (!isHttpsUrl(url)) {
      setError("https の ICS URL を入力してください");
      return;
    }
    if (settings.icsUrls.includes(url)) {
      setError("同じ URL は追加済みです");
      return;
    }
    if (settings.icsUrls.length >= MAX_CALENDARS) {
      setError(`ICS URL は ${MAX_CALENDARS} 件まで追加できます`);
      return;
    }

    setSettings((previous) => ({ ...previous, icsUrls: [...previous.icsUrls, url] }));
    setNewUrl("");
    setError(undefined);
  };

  const removeUrl = (url: string) => {
    setSettings((previous) => ({ ...previous, icsUrls: previous.icsUrls.filter((item) => item !== url) }));
    setError(undefined);
  };

  return (
    <div className="space-y-4">
      <SettingField
        label="ICS カレンダー URL"
        description="Google カレンダーなどの非公開 ICS URL を3件まで登録できます。"
        error={error}
        wide
      >
        <div className="flex gap-2">
          <TextInput
            type="url"
            value={newUrl}
            onChange={(event) => {
              setNewUrl(event.target.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addUrl();
              }
            }}
            placeholder="https://calendar.example/private.ics"
            autoComplete="off"
            className="min-w-0 flex-1"
          />
          <ActionButton
            variant="primary"
            onClick={addUrl}
            disabled={settings.icsUrls.length >= MAX_CALENDARS || newUrl.trim() === ""}
          >
            追加
          </ActionButton>
        </div>
      </SettingField>

      {settings.icsUrls.length > 0 ? (
        <div className="grid gap-2">
          {settings.icsUrls.map((url) => (
            <div key={url} className="flex min-w-0 items-center gap-3 rounded-lg bg-surface-muted px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink-muted" title={url}>
                {url}
              </span>
              <ActionButton variant="danger" onClick={() => removeUrl(url)} className="shrink-0 px-2 py-1">
                削除
              </ActionButton>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-surface-muted px-3 py-2.5 text-sm text-ink-subtle">未登録</div>
      )}
    </div>
  );
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
