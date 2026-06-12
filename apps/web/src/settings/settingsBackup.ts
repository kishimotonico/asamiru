import { hasOwn, isRecord } from "../lib/guards";
import { isSleepSettings, SLEEP_SETTINGS_STORAGE_KEY } from "../sleep/sleepSettingsAtom";
import { isThemePreference, THEME_STORAGE_KEY } from "../theme/themeAtom";
import { isCalendarSettings, CALENDAR_SETTINGS_STORAGE_KEY } from "./calendarSettingsAtom";
import { isTrainsSettings, TRAINS_SETTINGS_STORAGE_KEY } from "./trainsSettingsAtom";
import { isWeatherSettings, WEATHER_SETTINGS_STORAGE_KEY } from "./weatherSettingsAtom";

export const SETTINGS_BACKUP_APP = "asamiru";
export const SETTINGS_BACKUP_VERSION = 1;

const SETTINGS_REGISTRY = [
  { key: WEATHER_SETTINGS_STORAGE_KEY, isValid: isWeatherSettings },
  { key: TRAINS_SETTINGS_STORAGE_KEY, isValid: isTrainsSettings },
  { key: CALENDAR_SETTINGS_STORAGE_KEY, isValid: isCalendarSettings },
  { key: SLEEP_SETTINGS_STORAGE_KEY, isValid: isSleepSettings },
  { key: THEME_STORAGE_KEY, isValid: isThemePreference },
] as const;

export type SettingsStorageKey = (typeof SETTINGS_REGISTRY)[number]["key"];
export const SETTINGS_STORAGE_KEYS: readonly SettingsStorageKey[] = SETTINGS_REGISTRY.map(
  ({ key }) => key,
);
export type SettingsBackupValues = Partial<Record<SettingsStorageKey, unknown>>;

export type SettingsBackup = {
  app: typeof SETTINGS_BACKUP_APP;
  version: typeof SETTINGS_BACKUP_VERSION;
  exportedAt: string;
  settings: SettingsBackupValues;
};

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "removeItem" | "setItem">;

export function createSettingsBackup(storage: StorageReader, exportedAt: Date): SettingsBackup {
  const settings: SettingsBackupValues = {};

  for (const { key } of SETTINGS_REGISTRY) {
    const storedValue = storage.getItem(key);
    if (storedValue === null) continue;

    try {
      settings[key] = JSON.parse(storedValue) as unknown;
    } catch {
      throw new Error(`設定「${key}」の保存値が正しい JSON ではありません。`);
    }
  }

  return {
    app: SETTINGS_BACKUP_APP,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    settings,
  };
}

export function parseSettingsBackup(json: string): SettingsBackupValues {
  let input: unknown;

  try {
    input = JSON.parse(json) as unknown;
  } catch {
    throw new Error("バックアップファイルが正しい JSON ではありません。");
  }

  if (!isRecord(input)) {
    throw new Error("バックアップファイルの形式が不正です。");
  }
  if (input.app !== SETTINGS_BACKUP_APP) {
    throw new Error("asamiru の設定バックアップではありません。");
  }
  if (input.version !== SETTINGS_BACKUP_VERSION) {
    throw new Error(`対応していないバックアップバージョンです（version: ${String(input.version)}）。`);
  }
  if (!isRecord(input.settings)) {
    throw new Error("バックアップファイルの settings がオブジェクトではありません。");
  }

  return validateSettings(input.settings);
}

export function applySettingsBackup(storage: StorageWriter, settings: Readonly<Record<string, unknown>>): void {
  const validatedSettings = validateSettings(settings);
  const serializedSettings = new Map<SettingsStorageKey, string>();

  for (const { key } of SETTINGS_REGISTRY) {
    if (!hasOwn(validatedSettings, key)) continue;

    let serializedValue: string | undefined;
    try {
      serializedValue = JSON.stringify(validatedSettings[key]);
    } catch {
      throw new Error(`設定「${key}」を JSON として保存できません。`);
    }
    if (serializedValue === undefined) {
      throw new Error(`設定「${key}」を JSON として保存できません。`);
    }
    serializedSettings.set(key, serializedValue);
  }

  for (const { key } of SETTINGS_REGISTRY) {
    storage.removeItem(key);
  }
  for (const [key, serializedValue] of serializedSettings) {
    storage.setItem(key, serializedValue);
  }
}

function validateSettings(settings: Readonly<Record<string, unknown>>): SettingsBackupValues {
  const validatedSettings: SettingsBackupValues = {};

  for (const { key, isValid } of SETTINGS_REGISTRY) {
    if (!hasOwn(settings, key)) continue;

    const value = settings[key];
    if (!isValid(value)) {
      throw new Error(`設定「${key}」の値が不正です。`);
    }
    validatedSettings[key] = value;
  }

  if (Object.keys(settings).length > 0 && Object.keys(validatedSettings).length === 0) {
    throw new Error("バックアップファイルに既知の設定が1件も含まれていません。");
  }

  return validatedSettings;
}
