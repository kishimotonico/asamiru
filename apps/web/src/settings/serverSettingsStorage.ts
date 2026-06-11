import { apiEndpoint } from "../data/apiEndpoint";
import { createLogger } from "../lib/logger";

type SettingsRecord = Record<string, unknown>;

type SyncStorage<T> = {
  getItem: (key: string, initialValue: T) => T;
  setItem: (key: string, value: T) => void;
  removeItem: (key: string) => void;
};

const SAVE_DEBOUNCE_MS = 1_000;
const MISSING = Symbol("missing");
const logger = createLogger("settings");

let serverSettings: SettingsRecord = {};
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let saveChain: Promise<void> = Promise.resolve();

function isSettingsRecord(value: unknown): value is SettingsRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function initializeServerSettings(settings: SettingsRecord): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = undefined;
  saveChain = Promise.resolve();
  serverSettings = { ...settings };
}

export async function loadServerSettings(): Promise<void> {
  const response = await fetch(apiEndpoint("/api/settings"));
  if (!response.ok) {
    throw new Error(`GET /api/settings failed with status ${response.status}`);
  }

  const settings: unknown = await response.json();
  if (!isSettingsRecord(settings)) {
    throw new TypeError("GET /api/settings must return a JSON object");
  }
  initializeServerSettings(settings);
}

export function serverSettingsStorage<T>(defaultValue: T): SyncStorage<T> {
  return {
    getItem(key, initialValue) {
      const localValue = readLocalStorage(key);
      const hasServerValue = Object.prototype.hasOwnProperty.call(serverSettings, key);
      const serverValue = serverSettings[key];

      let value: T;
      if (isSettingsRecord(defaultValue)) {
        value = {
          ...initialValue,
          ...(isSettingsRecord(localValue) ? localValue : {}),
          ...(hasServerValue && isSettingsRecord(serverValue) ? serverValue : {}),
        } as T;
      } else if (hasServerValue) {
        value = serverValue as T;
      } else if (localValue !== MISSING) {
        value = localValue as T;
      } else {
        value = initialValue;
      }

      serverSettings[key] = value;
      browserStorage()?.setItem(key, JSON.stringify(value));
      return value;
    },
    setItem(key, value) {
      browserStorage()?.setItem(key, JSON.stringify(value));
      serverSettings[key] = value;
      scheduleSave();
    },
    removeItem(key) {
      browserStorage()?.removeItem(key);
      delete serverSettings[key];
      scheduleSave();
    },
  };
}

function readLocalStorage(key: string): unknown | typeof MISSING {
  const raw = browserStorage()?.getItem(key);
  if (!raw) return MISSING;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return MISSING;
  }
}

function browserStorage(): Storage | undefined {
  return typeof localStorage === "undefined" ? undefined : localStorage;
}

function scheduleSave(): void {
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    const body = JSON.stringify(serverSettings);
    saveChain = saveChain
      .then(() => saveSettings(body))
      .catch((error: unknown) => {
        logger.error("Failed to persist settings", error);
      });
  }, SAVE_DEBOUNCE_MS);
}

async function saveSettings(body: string): Promise<void> {
  const response = await fetch(apiEndpoint("/api/settings"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
  if (!response.ok) {
    throw new Error(`PUT /api/settings failed with status ${response.status}`);
  }
}
