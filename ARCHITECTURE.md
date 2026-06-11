# ARCHITECTURE

asamiru の設計概要。個人用の朝見るダッシュボードで、Raspberry Pi 1台で完結して動くことを前提にする。詳細な意思決定は `docs/adr/` を参照。

## 全体構成

pnpm workspace のモノレポ。

```
apps/
  web/    Vite + React SPA（ダッシュボード本体）
  api/    Hono backend（鉄道情報の取得・正規化、モニター制御の公開、静的配信）
packages/
  shared/           Web/API 共有の型と路線マスタ
  display-control/  物理モニター制御（Node専用・オプショナル）
```

本番は API サーバーが `apps/web/dist` も静的配信するため、リバースプロキシなしで Node だけで動く。

データの流れは2系統。天気はブラウザから Open-Meteo を直接取得する。鉄道情報（次発・運行情報）は API がスクレイピング・正規化し、Web は POST で取得する。サーバー側にだけ外部APIキャッシュとデバッグ計測を置く。

## Web アプリ

### データ取得と設定

サーバー状態は TanStack Query、ユーザー設定は jotai の `atomWithStorage` で管理する。設定の永続化は API サーバーの JSON ファイルを権威とし、localStorage は同期キャッシュとして使う。両者を `queryKey` に設定値を含めて連動させ、設定変更で自動再フェッチさせる。設定の理由は [ADR: Jotai 採用](docs/adr/2026-05-30-jotai-for-module-settings.md) と [ADR: 設定のサーバー JSON 永続化](docs/adr/2026-06-11-server-settings-persistence.md) を参照。

- `data/*` … fetch を担う薄い関数群（`apiEndpoint` で相対パスを組み立てる）。
- `dashboard/dashboardQueries.ts` … `queryOptions` を集約。staleTime / refetchInterval をここで一元管理。
- `settings/*Atom.ts` … ドメインごとの設定 atom。サーバー設定、localStorage、デフォルトをマージし、フィールド追加に強くする。

### コンポーネント

`Dashboard` がレイアウトとカード配置を持ち、各カードは「データ取得を担うラッパー」と「表示専用のプレゼンテーション」に分かれる。非同期カードは `AsyncCardBoundary`（Suspense + ErrorBoundary + QueryErrorResetBoundary）で個別に境界化し、1カードの失敗が全体を巻き込まないようにする。

型は per-domain（`WeatherData` / `TrainsData`）に分割する。1つの巨大な状態型に全ドメインを束ねない。

### スリープ / モニター連動

責務を3つのフックに分離し、`useSleepController` はそれらを合成するだけの薄い層に保つ。

- `useSleepIntent` … アプリの「スリープ意図」を判別共用体 `SleepIntent`（`schedule` / `tempAwake` / `forcedSleep`）の state machine で持つ。tick・設定追従を内包し、純粋関数 `sleepIntentReducer` / `selectDesiredSleeping` として算出する。`forcedSleep` は `releaseAt`（次の起床帯開始）で自動解除し、tick 取りこぼしに依存しない。
- `useDisplaySync` … 物理モニター連動。初期化はバックオフ付きリトライ（`connectWithRetry`）で行い起動順序に強くする。desired power の送信（skip-if-matches）、SSE 購読、外部 ON/OFF のスリープ意図への橋渡しを担う。アプリの意図そのものは持たない。
- `useGlobalInput` … キーボード・ポインタ・ダブルクリックを window の capture リスナで1か所に集約する。

意図と物理状態を二重管理しない設計（意図はクライアント、物理状態はサーバー）の根拠は [ADR: client sleep intent / server display state](docs/adr/2026-06-03-client-sleep-intent-server-display-state.md) を参照。状態モデル・遷移図・操作仕様・課題と改善提案は [スリープ / ディスプレイ連動 仕様](docs/sleep-display-spec.md) にまとめる。

```
showSleepScreen = desiredSleeping || (モニター有効 && 物理OFF)   # 受動的な表示ゲート
desiredSleeping = mode で決まる:
  forcedSleep → releaseAt 未到達なら true / tempAwake → until 未到達なら false / schedule → スリープ帯なら true
```

window へ一度だけ登録するリスナや、最新の意図を読む必要がある箇所では「最新値を ref に同期」するパターンを各フック内に閉じ込め、合成層には漏らさない。

### ログ

`lib/logger.ts` の名前空間つき軽量ロガーに集約する。`warn`/`error` は常時、`info`/`debug` は開発時または `localStorage.asamiru-debug=1` のときだけ出力し、本番 kiosk のコンソールを汚さない。接頭辞（例 `[display]`）をサーバー側の構造化ログと揃える。

## API

Hono の薄いアプリ。`/api/*` に correlation-id ミドルウェアを通し、鉄道情報のルートと、モニター制御ルート（`displayRoutes`）を登録する。最後に SPA を静的配信する。dev では Vite proxy が `/api` を同一オリジン転送するため CORS ミドルウェアは不要。本番は API が web dist を同一オリジンで配信するため CORS は不要。

- 外部API（Yahoo路線情報）は `withUpstream` でラップして計測し、インメモリで TTL キャッシュする。
- `metrics.ts` が `AsyncLocalStorage` で correlation-id を伝播し、デバッグイベントを記録する。`/api/debug/metrics` と Web の DebugOverlay で可視化する。
- モニター制御ルートは loopback からのみ許可（fail-close）。GET 状態・PUT desired-power・SSE events を公開する。

## display-control パッケージ

物理モニター制御を Node 専用パッケージに隔離し、実行時にオプトアウト可能にする（[ADR](docs/adr/2026-06-03-optional-display-control-package.md)）。`DisplayService` が状態機械の中核で、DRM connector 監視（udev）と DDC/CI コマンドを直列キューで扱い、観測のきっかけ（trigger）と電源変化の主体（origin）を区別して通知する。

- ドライバ抽象（`DisplayDriver`）で実機（ddc-ci）とテスト用（fake）を差し替える。
- 無効時は一切ハードウェアに触れない `NullDisplayService` を返す（暗黙のフォールバックはせず、設定不備は起動時に警告する）。
- 診断ログは `createDisplayService` のラッパー層で構造化して出力する。

## テスト

ロジックの核は純粋関数に寄せ、vitest でユニットテストする。

- `apps/web` … スリープ意図の reducer / selector / スケジュール判定。
- `apps/api` … display ルートの振る舞い。
- `packages/display-control` … 状態機械とサービス生成。

`pnpm test` で全パッケージを実行する。
