# デバッグオーバーレイ改善計画

## 背景

現状の DebugOverlay は `/api/debug/metrics` の固定構造に強く依存している。
交通系 API だけを前提にしたカードがあり、今後 Google Calendar など API 利用箇所が増えるたびに UI と型を調整する必要がある。

また、API 履歴は `area` / `event` / `detail` の生ログに近く、以下が読み取りづらい。

- フロントからバックエンドへの API リクエストなのか
- バックエンドから外部 API へのリクエストなのか
- キャッシュヒットなのか
- キャッシュミス後に外部 API へアクセスしたのか
- 単なる計算・正規化ログなのか

今回の主目的は、サーバーが外部 API エンドポイントへ不要な負荷をかけていないかを確認できるようにすること。
フロントエンドの詳細な通信状態や TanStack Query の状態は、既存の DevTools で確認できるため DebugOverlay では再実装しない。

## 改善方針

この改善は UI の小修正ではなく、デバッグ情報の保存・集計・表示を今後の API 追加に耐える形へ作り直す。
修正量よりも、ログの意味が破綻しないこと、API 追加時に DebugOverlay の専用 UI を増やさなくてよいことを優先する。

### 1. 表示入口

- トグルショートカットは JIS キーボードで押しやすい `@` に変更する。
- 既存の `` ` `` は廃止するか、短期間だけ併用するかを実装時に判断する。
- 画面右下にホットゾーンを設け、マウスカーソルが右下付近に来たときだけ小さな Debug ボタンを表示する。
- ボタンは通常時は不可視に近い状態にし、通常のダッシュボード閲覧を邪魔しない。

### 2. 初回表示

- オーバーレイを開いたタイミングで `/api/debug/metrics` を 1 回だけ自動取得する。
- 常時ポーリングはしない。
- Refresh は手動再取得として残す。
- 初回取得中・失敗・履歴なしを明確に表示する。

### 3. 情報の分離

バックエンドのデバッグ情報とフロントエンドの表示環境情報は、UI 上で明確に分ける。
ただし、独自のフロントエンドログ基盤は作らない。

- Backend
  - ブラウザから受けた API リクエスト
  - バックエンドから外部 API へ出したリクエスト
  - サーバー側キャッシュの hit / miss
  - API 処理内の計算・正規化・失敗
- Frontend
  - viewport width / height
  - breakpoint
  - DPR
  - scroll position
  - 必要最小限の表示環境情報

TanStack Query の fetch / success / error / cache 状態は TanStack Query Devtools に任せる。
Chrome DevTools の Network / Console で分かる情報も、バックエンドの外部 API 負荷確認に直接役立つ要約でない限り DebugOverlay には持ち込まない。

UI は Backend を主画面にし、Frontend はヘッダーまたは小さな Environment パネルに留める。

### 4. UI 構造

API ごとの専用カードは廃止する。

代わりに、将来 API が増えても維持しやすい以下の構成にする。

- Header
  - viewport / breakpoint / DPR / scroll
  - last metrics update
  - Refresh / Hide
- Environment
  - フロント側で現在表示している viewport / breakpoint / DPR / scroll のみ
- System Summary
  - backend API received count
  - upstream external request count
  - cache hit count
  - cache miss count
  - error count
  - latest event time
- API Stats Table
  - API 名
  - backend request count
  - upstream request count
  - cache hit count
  - cache miss count
  - error count
  - last event time
- Event History
  - 時刻
  - 種別
  - 対象
  - 結果
  - cache
  - upstream
  - 詳細
- Event Detail
  - 履歴行をクリックしたら詳細ペインまたはモーダルを開く
  - request id / correlation id
  - duration
  - method / path / upstream URL
  - cache key
  - status code
  - sanitized payload summary
  - error message / stack summary
  - related events

API 固有の統計はカードではなくテーブルで表現する。
Google Calendar など新しい API が増えても、メトリクスの `apiStats` 配列に行が増えるだけで UI 実装を変更しない。
このテーブルは、外部 API への負荷状況を確認するための入口として扱う。

### 5. ログ表現

現在の `ApiDebugEvent` は人間が意味を推測する必要があるため、イベントの種類を明示する。

候補:

```ts
type ApiDebugEvent = {
  id: string;
  at: string;
  kind:
    | "backend_request"
    | "upstream_request"
    | "cache_hit"
    | "cache_miss"
    | "calculation"
    | "error";
  api: string;
  target: string;
  summary: string;
  detail?: Record<string, unknown>;
  correlationId?: string;
  durationMs?: number;
  status?: number;
};
```

例:

- `backend_request`: browser/web から `POST /api/rail/departures` を受けた
- `upstream_request`: API サーバーが opentidkeio / Yahoo / Google など外部 API へアクセスした
- `cache_hit`: 外部 API に行かず、サーバー内キャッシュで返せた
- `cache_miss`: キャッシュがなく、後続で外部 API アクセスが必要になった
- `calculation`: 取得済みデータから発車情報などを算出した
- `error`: API / 外部 API / パース / 計算で失敗した

### 6. イベント詳細と相関

ログ行は一覧で概要を読み、クリックで詳細を見る。

- 一覧は 1 行で判断できる情報だけを表示する。
- 詳細は `detail` オブジェクトを整形表示する。
- 同じ API 呼び出しから派生したイベントは `correlationId` で束ねる。
- 詳細ペインでは同じ `correlationId` の関連イベントも表示する。
- payload はそのまま保存せず、必要最小限の要約だけ保存する。
- URL、cache key、status、duration は詳細に含める。

### 7. メトリクス構造

API 別の固定フィールドをトップレベルに増やす設計はやめる。

候補:

```ts
type ApiDebugMetrics = {
  totals: {
    backendRequests: number;
    upstreamRequests: number;
    cacheHits: number;
    cacheMisses: number;
    errors: number;
  };
  apiStats: Array<{
    api: string;
    label: string;
    backendRequests: number;
    upstreamRequests: number;
    cacheHits: number;
    cacheMisses: number;
    errors: number;
    lastEventAt?: string;
  }>;
  events: ApiDebugEvent[];
  lastUpdatedAt: string;
};
```

API 固有の統計は `apiStats` の行として追加する。
UI は固定カラムのテーブルとして描画し、API ごとの専用コンポーネントを持たない。

### 8. 保存アーキテクチャ

バックエンドは in-memory の ring buffer と集計 Map を持つ。
永続化は現時点では行わない。

- `DebugEventStore`
  - 直近 N 件のイベントを保持
  - `api + kind` で集計
  - `correlationId` で関連イベントを検索できる
- `recordDebugEvent(event)`
  - 汎用イベント登録 API
  - totals と apiStats を同時更新
- 既存の `recordLineStatus*` / `recordDepartures*` は廃止し、呼び出し側を `recordDebugEvent` へ直接置き換える
- フロントエンド
  - 独自 event store は作らない
  - DebugOverlay コンポーネント内で viewport / breakpoint / DPR / scroll だけを保持する
  - TanStack Query 関連は既存 DevTools を使い、DebugOverlay では扱わない

### 9. ライブラリ導入方針

大きな監視基盤はまだ不要。
ただし、実装が複雑になる箇所では小さなライブラリ導入を許容する。

- ID 生成: `crypto.randomUUID()` を優先し、ライブラリは不要
- 日時整形: 現状の `Intl.DateTimeFormat` で十分
- テーブル: まず素の table で実装し、列ソート・フィルタが必要になったら `@tanstack/react-table` を検討
- ログ詳細の JSON 表示: まず自前の整形表示。必要になったら軽量 viewer を検討

### 10. ログの読みやすさ

- `kind` ごとにラベルと色を分ける。
- `upstream_request` は「外部APIアクセス」と明示する。
- `backend_request` は「アプリAPI受信」と明示する。
- `cache_hit` は「外部アクセスなし」と表示する。
- `cache_miss` は「この後 upstream が発生しうる」と補足する。
- テーブル上部に短い凡例を置く。
- `detail` が URL の場合は横スクロールまたはコピーしやすい monospace 表示にする。
- 行クリックで詳細が開けることを視覚的に分かるようにする。

## 実装手順

1. `packages/shared/src/index.ts` の `ApiDebugMetrics` / `ApiDebugEvent` を汎用スキーマへ変更する。
2. `apps/api/src/metrics.ts` に `DebugEventStore` を作り、汎用カウンタ・汎用イベント記録へ置き換える。
3. 既存の `recordLineStatus*` / `recordDepartures*` 関数は廃止し、呼び出し側を `recordDebugEvent` へ直接置き換える。
4. バックエンド側イベントへ `api` / `kind` / `correlationId` / `detail` を入れる。
5. DebugOverlay はフロント側 Environment 情報を既存の `snapshot()` ベースで保持する。
6. DebugOverlay を Environment、System Summary、API Stats Table、Event History、Event Detail に再構成する。
7. `DebugOverlay` の初期状態を hidden にし、`@` キーと右下ホットゾーンボタンで開けるようにする。
8. オーバーレイが開いたタイミングで backend metrics を一度だけ自動取得する。
9. Event History の行クリックで詳細ペインを開く。
10. agent-browser で以下を確認する。
   - 初期表示でパネルが出ない
   - `@` で表示/非表示を切り替えられる
   - 右下ホットゾーンでボタンが出る
   - パネル表示直後に履歴がロードされる
   - Environment と Backend metrics が分かれて見える
   - API Stats Table が API 行追加に耐える
   - ログ種別が意味として読める
   - ログクリックで詳細と関連イベントが見える
   - 外部 API リクエスト数と cache hit / miss がすぐ確認できる

## 非対象

- 常時ポーリング
- API ごとの専用ダッシュボードカード
- TanStack Query Devtools と重複する fetch / cache 状態表示
- Chrome DevTools で十分分かるフロント通信・Console 情報の再表示
- Prometheus / Grafana 向け `/metrics`
- 本番で DebugOverlay を常時表示すること
- フロントイベント store の追加
- フロントイベントをサーバーへ送信または永続化すること

## レビュー結果（2026-06-01）

Claude によるコードレビュー。現状コードを読んだ上での指摘と、確定した実装方針。実装は Codex が担当する。

### 確定した方針

レビューを踏まえ、以下を確定した。

- 計測基盤: `AsyncLocalStorage` で `correlationId` をリクエストスコープに持たせ、外部 API アクセスは計測ラッパで包んで `durationMs` / `status` / `error` を記録する。
- 既存 `recordLineStatus*` / `recordDepartures*` は thin wrapper を残さず、呼び出し側を直接 `recordDebugEvent` へ書き換える（破壊的変更OKの方針に沿う）。
- トグルキーは `@` に置き換え、backtick(`` ` ``) は廃止する。

### 方向性への評価（合意）

- 固定フィールド（`lineStatus` / `departures`）→ `apiStats` 配列＋固定カラムテーブル化は正しい。API 追加が「行が増えるだけ」になる。
- `kind` を型で明示してログの意味（受信 / 外部アクセス / cache / 計算 / error）を表現する点は確実な改善。現状の `area: "api" | "lineStatus" | "departures"` は「受信」と「処理領域」が混在し読み手の推測に依存している。
- 「開いたとき1回＋手動 Refresh、常時ポーリングしない」「フロントは Environment のみで TanStack / Chrome DevTools と重複させない」スコープの引き方は堅実。

### 重要な指摘

A. `correlationId` / `durationMs` / `status` の出どころが未設計（最重要）

`record*` は `fetchLineStatus`（`apps/api/src/index.ts:99`〜）や `departures.ts` の `getCachedStop` / `fetchTraffic` / `fetchDia`（`apps/api/src/departures.ts:271`〜`403`）といったリクエスト文脈を持たないヘルパ深部で呼ばれている。さらに `recordLineStatusUpstreamRequest(url)` は fetch する前に単発で呼ぶ構造（`apps/api/src/index.ts:143`）。このままだと `correlationId` はヘルパまで伝わらず、`durationMs` / `status` も fetch 前記録のため原理的に取れない。

対応（確定方針どおり）:

- Hono の middleware で `AsyncLocalStorage` にリクエストごとの `correlationId`（`crypto.randomUUID()`）を入れ、深部の `recordDebugEvent` から補完する。
- 外部 API は `withUpstream(api, url, () => fetch(...))` のような計測ラッパにし、成功時に `upstream_request`（duration / status）、throw 時に `error` を記録する。「fetch前record」の場当たり構造を廃止する。

B. `error` イベントを記録する手順が抜けている

`kind: "error"` を型に足す一方、現状の失敗は `console.error` だけでイベント化されていない（`apps/api/src/index.ts:54`, `apps/api/src/index.ts:92`、および `departures.ts` の各 fetch catch）。外部 API 負荷を見る目的では upstream の失敗こそ重要なので、既存の catch 地点で `error` イベントを記録する手順を実装手順に明示すること。

C. `source: "backend"` 固定は現状ほぼ無意味

非対象に「フロントイベントをサーバーへ送信しない」とある以上 `source` は常に `"backend"` で、集計キー `api + source + kind` の `source` も効かない。スキーマからは削除し、集計キーは `api + kind` にする（将来フロント送信を始める時点で再導入する）。

D. `api` キーの正準リスト（registry）が未定義

`apiStats` の `label` を安定させるため、`api` キー → `label` の単一情報源（const map）を `packages/shared/src/index.ts` に置き、記録側・表示側の両方が参照する。初期値の例:

```ts
export const API_DEBUG_LABELS: Record<string, string> = {
  "rail/line-status": "運行情報",
  "rail/departures": "発車情報",
};
```

E. `calculation` kind に集計列がない

`apiStats` / `totals` に calculation のカウンタが無い。意図的（計算は履歴のみ・集計しない）であることを仕様として明記し、`recordDebugEvent` 側も `calculation` ではカウンタを更新しない。

### 軽い指摘（過剰設計の回避）

- F. 互換 thin wrapper は不要。内部利用のみ＆破壊的変更OKのため、呼び出し側を `recordDebugEvent` 直書きに置換する（確定方針）。
- G. 専用リングバッファは不要。現状の `unshift`＋`length = MAX_EVENTS`（50）切り詰めで十分。
- H. `@` トグルは、`input` / `textarea` / `select` / `contenteditable` にフォーカスがある間は無視するガードを必ず入れる（`@` は通常入力で打つ文字。現状の backtick にもガードが無い）。

### 実装手順への反映（差分）

元の「実装手順」に対し、以下を追加・修正する。

- 手順の最初に「`AsyncLocalStorage` によるリクエストスコープ `correlationId` の付与（Hono middleware）」と「外部 API 用の計測ラッパ `withUpstream` の追加」を置く。
- 手順4は、上記基盤の上で `api` / `kind` / `correlationId` / `durationMs` / `status` / `detail` を埋める、と具体化する（`source` は廃止）。
- 既存 catch 地点（`apps/api/src/index.ts:54`, `apps/api/src/index.ts:92`、`departures.ts` の各 fetch catch）に `error` イベント記録を追加する手順を明示する。
- `API_DEBUG_LABELS` const map を追加し、記録側・テーブル表示側が参照する手順を追加する。
- 手順7の `@` トグルに「フォーム要素フォーカス中は無視」のガードを明記する。

## 実装結果（2026-06-01）

Codex が実装した内容。

- `packages/shared/src/index.ts`
  - `ApiDebugMetrics` を `totals` / `apiStats` / `events` の汎用構造へ変更。
  - `ApiDebugEvent` を `kind` / `api` / `target` / `summary` / `detail` / `correlationId` / `durationMs` / `status` を持つ構造へ変更。
  - `API_DEBUG_LABELS` を追加。
- `apps/api/src/metrics.ts`
  - `AsyncLocalStorage` でリクエスト単位の `correlationId` を保持。
  - `recordDebugEvent` と `withUpstream` を追加。
  - `calculation` は履歴のみで、集計カウンタには含めない。
- `apps/api/src/index.ts`
  - Hono middleware で `correlationId` を付与。
  - line-status の backend request / cache hit / cache miss / upstream / error を汎用イベントで記録。
- `apps/api/src/departures.ts`
  - departures の backend request / traffic cache / dia cache / stop cache / upstream / calculation / error を汎用イベントで記録。
  - `dia` in-flight 共有は維持し、外部 API への重複リクエストを抑制。
- `apps/web/src/debug/DebugOverlay.tsx`
  - 初期非表示に変更。
  - `@` で表示切り替え。フォーム要素フォーカス中は無視。
  - 右下ホットゾーンの Debug ボタンを追加。
  - 開いたタイミングで metrics を一度だけ自動取得。
  - Environment、System Summary、API Stats Table、Event History、Event Detail へ再構成。

### 検証

- `pnpm build`
- `GET http://asa-api.localhost:1355/api/health`
- `GET http://asa-api.localhost:1355/api/debug/metrics`
- `POST http://asa-api.localhost:1355/api/rail/departures`
- `POST http://asa-api.localhost:1355/api/rail/line-status`
- portless の `asa-api` route が stale PID を保持していたため、最終確認は `PORT=8787 node apps/api/dist/index.js` で一時起動して実施。
  - `GET http://localhost:8787/api/health`
  - `POST http://localhost:8787/api/rail/departures`
  - `GET http://localhost:8787/api/debug/metrics`
- agent-browser で以下を確認。
  - 初期表示ではパネルが出ない。
  - 右下ホットゾーンの Debug ボタンで開ける。
  - `@` で表示/非表示を切り替えられる。
  - API Stats Table が表示される。
  - Event History に `API受信` / `外部API` / `Cache hit` / `Cache miss` / `計算` が表示される。
  - 行クリックで Event Detail が表示される。
