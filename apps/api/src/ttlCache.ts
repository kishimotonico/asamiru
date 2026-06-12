import { recordDebugEvent } from "./metrics.js";

/** getOrFetch が記録する debug イベントの内容。 */
export type TtlCacheEvent = {
  /** recordDebugEvent の target */
  target: string;
  /** キャッシュヒット時の summary */
  hitSummary: string;
  /** キャッシュミス時の summary */
  missSummary: string;
  /** in-flight 相乗り時の summary */
  inflightSummary: string;
  /** detail に追記する付加情報（cache 名は自動で付与される） */
  detail?: Record<string, unknown>;
};

export type TtlCache<V> = {
  /**
   * キーに対応する値を返す。キャッシュヒット（cache_hit）／同一キーの取得が進行中なら
   * in-flight の Promise に相乗り（cache_hit + state: "inflight"）／ミスなら fetcher を実行
   * （cache_miss）の3パターン。fetcher が失敗した場合はキャッシュに残さない。
   */
  getOrFetch(key: string, event: TtlCacheEvent, fetcher: () => Promise<V>): Promise<V>;
  /** 述語が true を返したキーをキャッシュ・in-flight の両方から削除する。 */
  prune(shouldDelete: (key: string) => boolean): void;
  /** キャッシュを全破棄し、破棄した値の件数を返す。 */
  clear(): number;
};

/** TTL つき get-or-fetch キャッシュ。in-flight 共有で同一キーの重複リクエストを防ぐ。 */
export function createTtlCache<V>({
  api,
  cacheName,
  ttlMs,
}: {
  /** recordDebugEvent の api */
  api: string;
  /** detail.cache に記録するキャッシュ名 */
  cacheName: string;
  /** キャッシュの有効期間（ミリ秒） */
  ttlMs: number;
}): TtlCache<V> {
  const cache = new Map<string, { value: V; expiresAt: number }>();
  const inflight = new Map<string, Promise<V>>();

  return {
    getOrFetch(key, event, fetcher) {
      const cached = cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        recordDebugEvent({
          kind: "cache_hit",
          api,
          target: event.target,
          summary: event.hitSummary,
          detail: { ...event.detail, cache: cacheName },
        });
        return Promise.resolve(cached.value);
      }

      const joined = inflight.get(key);
      if (joined) {
        // in-flight 相乗りは上流リクエストが増えないため cache_hit として数える
        recordDebugEvent({
          kind: "cache_hit",
          api,
          target: event.target,
          summary: event.inflightSummary,
          detail: { ...event.detail, cache: cacheName, state: "inflight" },
        });
        return joined;
      }

      recordDebugEvent({
        kind: "cache_miss",
        api,
        target: event.target,
        summary: event.missSummary,
        detail: { ...event.detail, cache: cacheName },
      });
      const request = fetcher()
        .then((value) => {
          cache.set(key, { value, expiresAt: Date.now() + ttlMs });
          return value;
        })
        .finally(() => {
          inflight.delete(key);
        });
      inflight.set(key, request);
      return request;
    },

    prune(shouldDelete) {
      for (const key of cache.keys()) {
        if (shouldDelete(key)) {
          cache.delete(key);
        }
      }
      for (const key of inflight.keys()) {
        if (shouldDelete(key)) {
          inflight.delete(key);
        }
      }
    },

    clear() {
      const count = cache.size;
      cache.clear();
      inflight.clear();
      return count;
    },
  };
}
