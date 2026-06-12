import { atomWithStorage } from "jotai/utils";

export type ThemePreference = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "asamiru-theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * テーマ設定。初期値は system（OS の prefers-color-scheme に追従）。
 * 手動で light / dark を選ぶと localStorage に永続化される。
 */
export const themeAtom = atomWithStorage<ThemePreference>(THEME_STORAGE_KEY, "system", undefined, {
  getOnInit: true,
});
