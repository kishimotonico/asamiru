import { useAtom } from "jotai";
import { CONCRETE_THEMES, themeAtom, type ThemePreference } from "../theme/themeAtom";
import { SettingField } from "./components/FormControls";

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [{ value: "system", label: "OSに従う" }, ...CONCRETE_THEMES];

export function ThemeSettingsSection() {
  const [theme, setTheme] = useAtom(themeAtom);

  return (
    <SettingField label="テーマ" description="OSに従う場合はシステムのライト/ダーク設定に追従します（朝焼けは明示選択のみ）。">
      <div className="inline-flex rounded-md border border-border-strong p-0.5">
        {OPTIONS.map((opt) => {
          const active = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              aria-pressed={active}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                active ? "bg-[var(--accent)] text-white" : "text-ink-muted hover:bg-surface-muted hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </SettingField>
  );
}
