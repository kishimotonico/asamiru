import { atomWithStorage } from "jotai/utils";

export type ThemePreference = "system" | "light" | "dark" | "dawn";
export type EffectiveTheme = "light" | "dark" | "dawn";

export const THEME_STORAGE_KEY = "asamiru-theme";

/** 具体テーマ（system が解決しうる値）の順序付き一覧。ThemeToggle のサイクル順と設定UIの並びはここに従う。 */
export const CONCRETE_THEMES = [
  { value: "light", label: "ライト" },
  { value: "dawn", label: "朝焼け" },
  { value: "dark", label: "ダーク" },
] as const satisfies ReadonlyArray<{ value: EffectiveTheme; label: string }>;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark" || value === "dawn";
}

/**
 * テーマ設定。初期値は system（OS の prefers-color-scheme に追従）。
 * 手動で light / dawn / dark を選ぶと localStorage に永続化される。
 */
export const themeAtom = atomWithStorage<ThemePreference>(THEME_STORAGE_KEY, "system", undefined, {
  getOnInit: true,
});
