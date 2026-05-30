# 京王線次発表示本数と停車判定キャッシュの改善計画

## 背景

設定で「表示本数（方向ごと）」を 5 にしても、下り終点寄りの駅では 2 本程度しか表示されないケースがある。

京王線・京王相模原線・高尾線は分岐を持つが、現在の次発取得ロジックは駅順をほぼ 1 本の直線として扱っている。そのため、橋本・南大沢・京王多摩センターなど相模原線方面の駅で、京王八王子方面・高尾山口方面の列車も「乗車駅より手前の下り列車」として候補に混ざる。

さらに、停車駅を確認する前に方向ごと固定本数で候補を打ち切っているため、枝違いの列車が候補枠を消費し、停車確認後に有効な列車が表示本数に満たない。

## 現状の問題

- `displayCount` は表示直前の `slice(0, displayCount)` にしか使われていない。
- `collectUpcomingTrains()` が停車確認前に `PREFETCH_LIMIT_PER_DIRECTION` で候補を打ち切っている。
- 乗車駅に停まるかどうかは `dia/{trainId}.json` を取得するまで分からない。
- ただし `dia` には遅延ではなく停車駅・予定時刻など比較的静的な情報が含まれるため、短周期で再取得する必要は低い。
- 無制限に候補を広げると `dia` API へのリクエストが過大になる。

## 方針

「走行位置・遅延」と「停車駅・予定時刻」を分けて扱う。

- `traffic_info.json`
  - 走行位置・遅延を含むため短周期更新を維持する。
  - 現状の 90 秒更新を基本とする。
- `dia/{trainId}.json`
  - 停車駅・予定時刻・行先など、運行日内ではほぼ変わらない情報として長めにキャッシュする。
  - `trainId` 単位の TanStack Query cache を引き続き使う。
- 停車判定
  - `trainId + boardingStation` の結果を別キャッシュに保存する。
  - 停車する列車だけでなく、停車しない列車も negative cache する。

## 取得アルゴリズム案

1. `displayCount` を `fetchTrains()` に渡す。
2. `queryKey` に `boardingStation` と `displayCount` を含める。
3. `traffic_info.json` から方向ごとに候補列車を広めに集める。
4. `ik` / `ik_tr` / 現在位置 / 乗車駅から、明らかに到達しない枝違い列車を `dia` 取得前に除外する。
5. 近い順に候補を処理する。
6. `stopCache(trainId, boardingStation)` があれば `dia` を取得せず停車判定結果を使う。
7. cache miss の場合のみ `dia/{trainId}.json` を取得する。
8. `dia.dy` に乗車駅があり、推定発車時刻が現在以降なら有効候補に入れる。
9. 方向ごとに有効候補が `displayCount` 本そろったら、その方向の探索を止める。
10. 上限まで確認しても不足する場合は、その本数だけ表示する。

## API リクエスト数の制御

候補探索には明示的な上限を設ける。

案:

- `MAX_DIA_CHECKS_PER_DIRECTION = min(10, max(displayCount + 4, displayCount * 2))`
- `displayCount = 5` の場合、方向ごと最大 10 列車まで確認する。
- 両方向でも最大 20 列車。
- `dia` は TanStack Query cache と停車判定 cache の両方を使うため、90 秒更新ごとに毎回 20 件飛ぶ設計にはしない。

この上限により、終点寄りの駅で枝違い列車が混ざっても追加探索できる一方、無制限な API リクエストは防ぐ。

## キャッシュ設計

### `dia` キャッシュ

既存の `trainDiaQueryOptions(trainId)` を活かす。

- key: `["keio", "dia", serviceDate, trainId]`
- TTL: 運行日内で長めに設定する。
- 現状の 12 時間 TTL でもよいが、日跨ぎ列車や終電後を考えるなら `serviceDate` を key に含める。

### 停車判定キャッシュ

`dia` 全体とは別に、軽量な停車判定結果を持つ。

候補:

```ts
type StopCacheKey = `${serviceDate}:${trainId}:${boardingStation}`;
type StopCacheValue =
  | { stops: true; scheduledMinutes: number; destination: string }
  | { stops: false };
```

使い方:

- `stops: false` も保存する。
- 枝違い列車を毎回 `dia` 取得して捨てることを避ける。
- メモリ上の `Map` か、TanStack Query cache の派生データとして管理する。

## ローカル事前フィルタ

`dia` 取得前に、明らかに到達しない列車を落とす。

例:

- 乗車駅が相模原線区間の場合
  - 行先コードが京王八王子・高尾山口方面の列車を原則除外する。
  - 相模原線内・橋本方面の列車を優先する。
- 乗車駅が高尾線区間の場合
  - 橋本方面の列車を原則除外する。
- 乗車駅が京王本線共通区間の場合
  - 分岐先を過度に除外しない。

この事前フィルタは `dia` リクエスト削減のための最適化であり、最終的な正しさは必ず `dia.dy` の停車駅確認で担保する。

## 実装手順

1. `FetchTrainsOptions` に `displayCount` を追加する。
2. `trainsQueryOptions()` の `queryKey` と `fetchTrains()` 呼び出しに `displayCount` を追加する。
3. `collectUpcomingTrains()` の固定 `slice(0, PREFETCH_LIMIT_PER_DIRECTION)` を廃止する。
4. 方向ごとの探索上限 `MAX_DIA_CHECKS_PER_DIRECTION` を導入する。
5. 事前フィルタ関数を追加する。
6. 停車判定 cache を追加する。
7. 有効候補が `displayCount` 本そろった方向から探索を停止する。
8. UI 側の表示直前 `slice(0, displayCount)` は防御的に残す。
9. テストまたはデバッグ用ログで、確認した候補数・dia cache hit・stop cache hit を確認できるようにする。

## 検証項目

- 明大前など共通区間で上下それぞれ最大 `displayCount` 本が表示される。
- 橋本・南大沢・京王多摩センターなど相模原線終点寄りで、下りが 2 本程度に欠けない。
- 京王八王子・高尾山口方面の駅で、相模原線方面列車が候補枠を消費しない。
- `displayCount = 5` で `dia` 取得が方向ごと最大 10 件程度に収まる。
- 90 秒更新時に、同じ `trainId + boardingStation` の停車判定で再度 `dia` を取得しない。
- 遅延表示は `traffic_info.json` の最新値を反映する。

## レビュー観点

- 停車判定 cache を TanStack Query cache で表現するか、`data/trains.ts` 内の `Map` にするか。
- `serviceDate` の算出方法。午前 0 時直後や終電後の扱いをどうするか。
- 事前フィルタの駅・行先コード対応表をどこまで明示的に持つか。
- 上限値 `10` が実利用に十分か。必要なら `displayCount` に応じて調整する。

## 実装メモ

- `displayCount` を `fetchTrains()` と query key に追加した。
- `dia` cache key に `serviceDate` を追加した。
- `serviceDate` は 04:00 未満を前日の運行日として扱う。
- `trains.ts` 内の module-level `Map` で `serviceDate + trainId + boardingStation` の停車判定 cache を持つ。
- `stops: false` も cache し、枝違い列車の再判定を避ける。
- `collectUpcomingTrains()` の停車確認前固定 slice を廃止した。
- `MAX_DIA_CHECKS_PER_DIRECTION = min(10, max(displayCount + 4, displayCount * 2))` を導入した。
- `ik_tr` と `ik` の両方を見て、相模原線方面 / 八王子・高尾方面の明らかな枝違いを `dia` 取得前に除外する。
- 実データで出ている高幡不動方面コード `027` も八王子・高尾側の事前フィルタ対象に含めた。

## 実装後確認

- `pnpm build`
- agent-browser で `南大沢 + displayCount=5` を確認し、下り 5 本が表示されることを確認。
- 同条件の直近ページロードで `dia` 取得が 14 件で、両方向最大 20 件以内に収まることを確認。
