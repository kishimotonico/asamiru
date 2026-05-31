# Departures API コードレビュー指摘修正

コミット `24a6577` に対するコードレビューの結果。以下を修正すること。

## 必須修正

### 1. fetchDepartures にタイムアウトがない

`apps/api/src/index.ts` の `/api/rail/departures` ハンドラーで `fetchDepartures` を呼ぶ際に `signal` も `AbortController` も渡していない。
opentidkeio が無応答の場合、リクエストが無期限にハングする。

`fetchLineStatus` が使う `fetchText`（`FETCH_TIMEOUT_MS = 5000`）と同等のタイムアウトを実装すること。
実装方針は `fetchText` に倣い、`AbortController` + `setTimeout` を `fetchDepartures` 呼び出し前に設定する。

```typescript
// index.ts の fetchDepartures 呼び出し箇所（line 82 付近）を修正
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
try {
  const response = await fetchDepartures({ boardingStation, displayCount, signal: controller.signal });
  ...
} finally {
  clearTimeout(timeoutId);
}
```

### 2. TrainStatusResponse 型エイリアスが未使用

`packages/shared/src/index.ts` の `export type TrainStatusResponse = LineStatusResponse;` は削除済みの `trainStatus.ts` が唯一の使用箇所だった。
現在はどこからも参照されていないため削除すること。

## 改善推奨

### 3. TRAFFIC_TTL_MS をクライアントの refetchInterval より短くする

`apps/api/src/departures.ts` の `TRAFFIC_TTL_MS = 90 * 1000` と、
`apps/web/src/dashboard/dashboardQueries.ts` の `DEPARTURES_INTERVAL_MS = 90 * 1000` が同値のため、
タイミング次第でサーバーの traffic キャッシュが毎回期限切れになりうる。

`TRAFFIC_TTL_MS` を 60秒程度に変更すること。
クライアントが 90秒ごとにリクエストを送っても、サーバーは 60秒のキャッシュが残っている区間でキャッシュヒットできる。

### 4. diaCache の古いエントリを日付変更時に削除する

`apps/api/src/departures.ts` で `stopCache` は `pruneStopCache` で日付変更時にクリアされるが、
`diaCache` には同等の処理がなく、前日のエントリ（キー `${serviceDate}:${trainId}`）が Map に残り続ける。

`pruneStopCache` と同様に `pruneDiaCache(serviceDate)` を実装し、`fetchDepartures` の冒頭で呼ぶこと。

```typescript
let diaCacheServiceDate: string | undefined;

function pruneDiaCache(serviceDate: string): void {
  if (diaCacheServiceDate === serviceDate) return;
  // 前日以前のエントリを削除（現在日付のエントリは残す）
  for (const key of diaCache.keys()) {
    if (!key.startsWith(serviceDate + ":")) {
      diaCache.delete(key);
    }
  }
  diaCacheServiceDate = serviceDate;
}
```

### 5. fetchTraffic の thundering herd 対策

キャッシュ期限切れ直後に複数リクエストが同時に来た場合、全員がキャッシュミスと判断して独立して `fetch(TRAFFIC_URL)` を発行する。
in-flight Promise を保持することで後続リクエストを同じ Promise に相乗りさせること。

```typescript
let trafficInflight: Promise<TrafficResponse> | undefined;

async function fetchTraffic(signal?: AbortSignal): Promise<TrafficResponse> {
  if (trafficCache && trafficCache.expiresAt > Date.now()) {
    recordDeparturesTrafficCacheHit();
    return trafficCache.value;
  }
  if (trafficInflight) {
    return trafficInflight;
  }
  recordDeparturesTrafficCacheMiss();
  recordDeparturesTrafficRequest();
  trafficInflight = fetch(TRAFFIC_URL, { signal })
    .then(async (response) => {
      if (!response.ok) throw new Error(`opentidkeio traffic returned ${response.status}`);
      const value = (await response.json()) as TrafficResponse;
      const normalized = { TS: Array.isArray(value.TS) ? value.TS : [], TB: Array.isArray(value.TB) ? value.TB : [] };
      trafficCache = { value: normalized, expiresAt: Date.now() + TRAFFIC_TTL_MS };
      return normalized;
    })
    .finally(() => { trafficInflight = undefined; });
  return trafficInflight;
}
```
