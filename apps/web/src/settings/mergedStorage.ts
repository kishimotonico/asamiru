type SyncStorage<T> = {
  getItem: (key: string, initialValue: T) => T;
  setItem: (key: string, value: T) => void;
  removeItem: (key: string) => void;
};

/**
 * localStorage からの復元値をデフォルト値とシャローマージするストレージ。
 * フィールドを追加した際も、古い保存値で undefined にならない。
 */
export function mergedStorage<T extends object>(defaultValue: T): SyncStorage<T> {
  return {
    getItem(key, initialValue) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return initialValue;
        return { ...initialValue, ...(JSON.parse(raw) as Partial<T>) };
      } catch {
        return initialValue;
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
