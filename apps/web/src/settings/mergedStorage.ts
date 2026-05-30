import type { SyncStorage } from "jotai/vanilla/utils";

/**
 * localStorage からの復元値をデフォルト値とシャローマージするストレージ。
 * フィールドを追加した際も、古い保存値で undefined にならない。
 */
export function mergedStorage<T extends object>(defaultValue: T): SyncStorage<T> {
  return {
    getItem(key) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return defaultValue;
        return { ...defaultValue, ...(JSON.parse(raw) as Partial<T>) };
      } catch {
        return defaultValue;
      }
    },
    setItem(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    removeItem(key) {
      localStorage.removeItem(key);
    },
  };
}
