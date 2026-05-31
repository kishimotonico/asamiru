# 交通情報取得頻度とサーバー処理方針

## 現状確認

- Yahoo路線の運行情報スクレイピングは `apps/api` の `/api/rail/line-status` で実行している。
- Web は `fetchLineStatus()` で自前APIを呼び、Yahooへ直接アクセスしていない。
- 変更前は Web 側の `TRAIN_STATUS_INTERVAL_MS` と API 側の `CACHE_TTL_MS` がどちらも2分だった。
- 京王の上り・下り次発表示は `apps/api` の `/api/rail/departures` で計算している。

## 対応内容

- Yahoo路線の運行情報更新を5分間隔へ変更。
- API の Yahoo スクレイピングキャッシュTTLを5分へ変更。
- `/api/rail/line-status` の `Cache-Control` を `max-age=300` に変更。
- `/api/rail/departures` を追加し、opentidkeio の取得・上り下り判定・停車判定をサーバー側へ移した。
- `/api/debug/metrics` を追加し、外部APIリクエスト状況をJSONで返すようにした。
- DebugOverlay に手動更新ボタンを追加し、`/api/debug/metrics` の内容を表示できるようにした。
- `/api/debug/metrics` に直近イベント履歴を追加し、API・キャッシュ・外部APIアクセスの流れを追えるようにした。
- DebugOverlay を小型HUDから大きなデバッグパネルへ変更し、集計カードと履歴テーブルを表示するようにした。

## 方針メモ

- Yahoo路線スクレイピングは負荷制御・HTMLパース隠蔽・CORS回避のためサーバー処理が適している。
- opentidkeio の次発計算は、個人利用かつCORS可能な現状ではクライアント処理でも成立する。
- 複数端末利用、取得頻度の一元制御、停車判定キャッシュ共有、クライアント実装の軽量化を重視するなら、上り・下り次発計算もサーバーへ寄せるのが適している。
- ただしクライアント直 fetch には Chrome DevTools で外部APIリクエスト回数を確認しやすい利点がある。
- サーバーへ処理を寄せる場合は、外部APIリクエスト状況を別経路で見える化する必要がある。
- Grafana/Prometheus 用には `/metrics` が適しているが、ダッシュボード内のデバッグ表示には JSON の `/api/debug/metrics` が扱いやすい。
- DebugOverlay では常時ポーリングせず、手動更新で `/api/debug/metrics` を取得する。

## 命名方針

- Yahoo路線の運行状況は `lineStatus` と呼ぶ。
- 京王の上り・下り次発表示は `departures` と呼ぶ。
- 既存の `trainStatus` は `lineStatus` へ、`trains` は `departures` へ段階的に改名する。

## 実装計画

1. API 命名を整理する。
   - `/api/train-status` を `/api/rail/line-status` へ移行する。完了。
   - Web 側の `fetchTrainStatus` / `trainStatusQueryOptions` を `fetchLineStatus` / `lineStatusQueryOptions` へ改名する。完了。
   - 5分TTL・5分refetchは維持する。完了。

2. 次発表示を `departures` として整理する。
   - Web 側の `fetchTrains` / `trainsQueryOptions` を `fetchDepartures` / `departuresQueryOptions` へ改名する。完了。
   - UI 内部の `DashboardData["trains"]` も、可能なら `rail` または `departures` に分離する。今回は表示カードの境界を保つため未実施。

3. 次発計算APIを追加する。
   - `/api/rail/departures` を追加する。完了。
   - `boardingStation` と `displayCount` を受け取り、opentidkeio の `traffic_info.json` / `dia/{trainId}.json` から次発を算出する。完了。
   - `traffic_info.json` の取得頻度と `dia` / 停車判定キャッシュをサーバー側で管理する。完了。

4. Web の交通取得をAPI経由に切り替える。
   - クライアントの opentidkeio 直接 fetch をやめる。完了。
   - Web は `/api/rail/departures` と `/api/rail/line-status` を取得し、交通カードに渡す。完了。

5. デバッグメトリクスを追加する。
   - `/api/debug/metrics` を追加し、JSONで外部APIリクエスト状況を返す。完了。
   - 例: `lineStatus.cacheHits`, `lineStatus.cacheMisses`, `lineStatus.upstreamRequests`, `departures.trafficRequests`, `departures.diaRequests`, `departures.diaCacheHits`, `lastUpdatedAt`。
   - 将来 Grafana で見る必要が出たら、別途 Prometheus形式の `/metrics` を追加する。

6. DebugOverlay を拡張する。
   - 手動更新ボタンで `/api/debug/metrics` を取得する。完了。
   - 常時更新はしない。完了。
   - 画面サイズ情報の下に、APIリクエスト状況を数行で表示する。完了。

7. 確認する。
   - `pnpm build`
   - `/api/rail/line-status`
   - `/api/rail/departures`
   - `/api/debug/metrics`
   - `agent-browser` でダッシュボード表示と DebugOverlay の手動更新を確認する。

## 確認

- `pnpm build`
- 既存の portless 開発サーバーで `GET http://asa-api.localhost:1355/api/health`
- 既存の portless 開発サーバーで `GET http://asa-api.localhost:1355/api/debug/metrics`
- 既存の portless 開発サーバーで `POST http://asa-api.localhost:1355/api/rail/line-status`（空配列）
- 既存の portless 開発サーバーで `POST http://asa-api.localhost:1355/api/rail/departures`
- `agent-browser` で `http://asa.localhost:1355/` を開き、交通カード表示と DebugOverlay の手動 refresh を確認。
- `agent-browser` で大型DebugOverlayの集計カード・API履歴テーブル表示を確認。

## レビューメモ（2026-05-31）

### 確認事項・修正が必要な点

- `/api/train-status` は現在 `POST` で `{ lines: WatchedLine[] }` をボディで受け取っている。`/api/rail/line-status` 移行時に GET に変更するかどうかを決めること。設定が固定なら GET が自然だが、POST のままでも動作に問題はない。
- `boardingStation` / `displayCount` をAPIパラメータで受け取る設計は汎用的だが、個人ダッシュボードなのでサーバー側の設定ファイルや環境変数から読む方が設計思想に合っている可能性がある。実装前に方針を確定させること。
- サーバー集約後、opentidkeio 障害時の挙動が未定義。API障害時にどのようなレスポンスを返すかを決めて実装すること（エラーを正直に返す、直前のキャッシュを返す、など）。

### 実装方針の調整

- ステップ1・2の命名変更は単独でやらず、ステップ3・4の機能実装と合わせて一度に行う方が効率的。
- `/api/debug/metrics` の DEV のみ制限は不要。個人ダッシュボードなので本番でも公開して構わない。本番でも外部APIリクエスト状況を確認できるようにしておくこと。
- キャッシュのTTL値を実装前に明確にしておく。`traffic_info.json` は運行情報なので短め（1〜2分程度）、`dia/{trainId}.json` は時刻表データなので長め（既存の `DIA_TTL_MS = 12h` を維持）が適切。

### レビュー対応

- `line-status` はクライアント設定の監視路線を送る必要があるため、GET ではなく POST を維持した。
- `departures` は設定モーダルの `boardingStation` / `displayCount` を反映するため、サーバー固定値ではなくリクエストボディで受け取る。
- opentidkeio 障害時はエラーを隠蔽せず、`502` とエラーメッセージを返す。
- `/api/debug/metrics` は本番でも利用できる通常APIとして公開し、DebugOverlay 側のみ DEV 表示のままにした。
- `traffic_info.json` は 90秒TTL、`dia/{trainId}.json` は 12時間TTL、停車判定cacheは運行日単位とした。

### セルフレビュー対応

- `departures` で個別列車の `dia` 取得失敗が交通カード全体の失敗になりやすかったため、列車単位でスキップし、全候補が失敗した場合のみ `502` にするよう修正。
- `line-status` で監視路線があるのに全件取得失敗した場合、空配列 `200` で問題を隠さないよう `502` を返すよう修正。
