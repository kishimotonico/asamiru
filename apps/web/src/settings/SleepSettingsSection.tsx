import { useAtom } from "jotai";
import { sleepSettingsAtom, type SleepWindow } from "../sleep/sleepSettingsAtom";
import { ActionButton, SettingField, TextInput } from "./components/FormControls";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function SleepSettingsSection() {
  const [settings, setSettings] = useAtom(sleepSettingsAtom);

  function patchWindow(id: string, patch: Partial<SleepWindow>) {
    setSettings((prev) => ({
      ...prev,
      windows: prev.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  }

  function toggleDay(id: string, day: number) {
    setSettings((prev) => ({
      ...prev,
      windows: prev.windows.map((w) => {
        if (w.id !== id) return w;
        const days = w.days.includes(day)
          ? w.days.filter((d) => d !== day)
          : [...w.days, day].sort((a, b) => a - b);
        return { ...w, days };
      }),
    }));
  }

  function addWindow() {
    setSettings((prev) => ({
      ...prev,
      windows: [
        ...prev.windows,
        { id: crypto.randomUUID(), days: [1, 2, 3, 4, 5], start: "06:00", end: "09:00" },
      ],
    }));
  }

  function removeWindow(id: string) {
    setSettings((prev) => ({ ...prev, windows: prev.windows.filter((w) => w.id !== id) }));
  }

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-3 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        スケジュールで自動スリープする
      </label>

      <div className="space-y-3">
        <div className="text-xs font-medium text-ink-subtle">
          起きてる時間帯（この時間帯の外は自動でスリープします）
        </div>
        {settings.windows.length === 0 ? (
          <div className="rounded-md bg-surface-muted px-3 py-2 text-xs text-ink-subtle">
            時間帯が未設定です。自動スリープは無効になります。
          </div>
        ) : null}
        {settings.windows.map((w) => (
          <div key={w.id} className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap gap-1.5">
              {DAY_LABELS.map((label, day) => {
                const active = w.days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(w.id, day)}
                    className={`h-8 w-8 rounded-md text-sm font-medium transition ${
                      active
                        ? "bg-[var(--accent)] text-white"
                        : "border border-border-strong bg-surface text-ink-muted hover:bg-surface-muted"
                    }`}
                    aria-pressed={active}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <TextInput
                type="time"
                value={w.start}
                onChange={(e) => patchWindow(w.id, { start: e.target.value })}
                className="w-32"
              />
              <span className="text-ink-subtle">〜</span>
              <TextInput
                type="time"
                value={w.end}
                onChange={(e) => patchWindow(w.id, { end: e.target.value })}
                className="w-32"
              />
              <ActionButton
                onClick={() => removeWindow(w.id)}
                variant="danger"
                className="ml-auto px-2 py-1"
                aria-label="この時間帯を削除"
              >
                削除
              </ActionButton>
            </div>
          </div>
        ))}
        <ActionButton onClick={addWindow} variant="secondary">
          時間帯を追加
        </ActionButton>
      </div>

      <SettingField
        label="操作後に自動スリープへ戻るまで（分）"
        description="起きてる時間帯の外で操作したあと、無操作のままこの時間が経過するとスリープします。"
      >
        <TextInput
          type="number"
          min={1}
          max={120}
          value={settings.manualWakeDurationMin}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (v >= 1) setSettings((prev) => ({ ...prev, manualWakeDurationMin: v }));
          }}
          className="w-full"
        />
      </SettingField>
    </div>
  );
}
