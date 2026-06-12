import { SLEEP_SETTINGS_STORAGE_KEY } from "../sleep/sleepSettingsAtom";
import { THEME_STORAGE_KEY } from "../theme/themeAtom";
import { CALENDAR_SETTINGS_STORAGE_KEY } from "./calendarSettingsAtom";
import { TRAINS_SETTINGS_STORAGE_KEY } from "./trainsSettingsAtom";
import { WEATHER_SETTINGS_STORAGE_KEY } from "./weatherSettingsAtom";

export const SETTINGS_BACKUP_APP = "asamiru";
export const SETTINGS_BACKUP_VERSION = 1;

export const SETTINGS_STORAGE_KEYS = [
  WEATHER_SETTINGS_STORAGE_KEY,
  TRAINS_SETTINGS_STORAGE_KEY,
  CALENDAR_SETTINGS_STORAGE_KEY,
  SLEEP_SETTINGS_STORAGE_KEY,
  THEME_STORAGE_KEY,
] as const;

export type SettingsStorageKey = (typeof SETTINGS_STORAGE_KEYS)[number];
export type SettingsBackupValues = Partial<Record<SettingsStorageKey, unknown>>;

export type SettingsBackup = {
  app: typeof SETTINGS_BACKUP_APP;
  version: typeof SETTINGS_BACKUP_VERSION;
  exportedAt: string;
  settings: SettingsBackupValues;
};

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

export function createSettingsBackup(storage: StorageReader, exportedAt: Date): SettingsBackup {
  const settings: SettingsBackupValues = {};

  for (const key of SETTINGS_STORAGE_KEYS) {
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

  const settings: SettingsBackupValues = {};
  for (const key of SETTINGS_STORAGE_KEYS) {
    if (hasOwn(input.settings, key)) {
      settings[key] = input.settings[key];
    }
  }

  if (Object.keys(settings).length === 0) {
    throw new Error("バックアップファイルに既知の設定が1件も含まれていません。");
  }

  return settings;
}

export function applySettingsBackup(storage: StorageWriter, settings: Readonly<Record<string, unknown>>): void {
  for (const key of SETTINGS_STORAGE_KEYS) {
    if (!hasOwn(settings, key)) continue;

    const serializedValue = JSON.stringify(settings[key]);
    if (serializedValue === undefined) {
      throw new Error(`設定「${key}」を JSON として保存できません。`);
    }
    storage.setItem(key, serializedValue);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
