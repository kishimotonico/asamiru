import { atomWithStorage } from "jotai/utils";
import { serverSettingsStorage } from "../settings/serverSettingsStorage";

export type ThemePreference = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

/**
 * テーマ設定。初期値は system（OS の prefers-color-scheme に追従）。
 * 手動で light / dark を選ぶと localStorage に永続化される。
 */
export const themeAtom = atomWithStorage<ThemePreference>(
  "asamiru-theme",
  "system",
  serverSettingsStorage<ThemePreference>("system"),
  { getOnInit: true },
);
