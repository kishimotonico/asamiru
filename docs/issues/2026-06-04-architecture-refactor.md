# 2026-06-04 設計見直しとリファクタリング

ダッシュボードに API 連携・デバッグログ・ディスプレイ連携が積み増され散らかってきたため、設計を見直した作業ログ。PL(Opus) が設計・統括し、単純な実装と挙動レビューは Sonnet エージェントへ委譲した。

## やったこと

### 1. README / .env.example の更新
設定値が env 変数から localStorage（設定UI）管理へ移行済みなのに古い記述が残っていたため修正。未使用の `VITE_KEIO_*` / `VITE_WEATHER_*` を削除し、実際に使う `VITE_API_ORIGIN` に整理。鉄道APIが POST である点・天気が Open-Meteo 直取得である点も明記。

### 2. 死にコード削除と型分割
import 元の無い `ScheduleCard.tsx` / `scheduleData.ts` / `data.ts` と、どこからも参照されていない `enabledModulesAtom.ts` を削除。モノリシックな `DashboardData` 型を per-domain の `WeatherData` / `TrainsData` に分割し、未使用の `now` / `schedule` / `holiday` 型を除去。

### 3. useSleepController の再設計（本作業の主眼）
290行・ref 多用の god-hook を責務分離した。

- `useSleepIntent`: スリープ意図を `useReducer` で管理。`sleepIntentReducer` / `selectDesiredSleeping` を純粋関数として切り出しテスト可能に。
- `useDisplaySync`: 物理モニター連動（desired power 送信・SSE購読・外部ON/OFF取り込み）。
- `useGlobalInput`: キーボード/ポインタ/ダブルクリック操作。
- `useSleepController`: 上記を合成するだけの薄い層。

死んでいた ref（manualSleepingRef 等）も除去。挙動は厳密維持を方針とした。

### 4. クライアントログの統一
散在する `console.info/warn("[display]...")` を `lib/logger.ts` の名前空間つきロガーへ集約。`warn`/`error` は常時、`info`/`debug` は DEV か `localStorage.asamiru-debug=1` のときだけ出力。

### 5. テスト基盤の追加
`apps/web` に vitest を導入。reducer / selector / スケジュール純粋関数のテスト 19 件を追加。これまで web 側は無テストだった。

### 6. ARCHITECTURE.md
確定した設計を `ARCHITECTURE.md` に記載。

## 判断の記録（要確認）

- enabledModulesAtom の削除: [ADR 2026-05-30 Jotai 採用](../adr/2026-05-30-jotai-for-module-settings.md) で「将来用骨格」と明記されていたが、現状どこからも参照されず YAGNI と判断して削除した。モジュールON/OFF 機能を実装する際に改めて設計し直す前提。ADR の記述と矛盾するため、方針が違えば差し戻してOK。
- 意図的な挙動差分: 旧 `applyExternalPower("off")` は `manualSleeping=true` のみで `now` を進めなかったが、新実装は `intent.actions.manualSleep`（`now` も進める）に統一した。スリープ結果は同値で、`now` 更新はスケジュール再評価を促すだけのため無害と判断。

## 残課題・今後の候補

- モジュールON/OFF（表示カードの有効化切替）は未実装。必要になった時点で設計する。
- web 側はフックの結合テスト（React Testing Library）が無い。純粋関数のテストで主要ロジックは押さえたが、フック合成の回帰検知は手薄。

## ラウンド2: サーバー側ほか追加リファクタ

オーナーの追加指示（「サーバー側 index.ts が長い」「他にもできるリファクタは全部」「過剰回避は気にしない」「今後の機能追加・デザイン改修に備える」）を受けて実施。

- API `index.ts` の責務分離: ブート・ルーティング・Yahoo API呼び出し＋HTMLパース・キャッシュ・静的配信・ライフサイクルが混在していた1ファイルを、`app.ts`（合成ルート）/ `lineStatus.ts`（Yahoo取得・パース・TTLキャッシュ）/ `railRoutes.ts`（鉄道HTTPルート）/ `staticFiles.ts`（静的配信）/ `errors.ts`（共通errorMessage）に分割。`index.ts` はブート＋serve＋シグナルのみに。`createApp` をテスト可能にし、鉄道ルート＋合成の自動テストを新規追加（api 16→23件）。`departures.ts` / `metrics.ts` の重複 errorMessage も解消。ルート登録順（display→health/debug→rail→404→static）は厳密維持。
- `packages/shared` をドメイン別（display / rail / debug / trainLines）に分割し index は re-export のみに。import パスは不変。
- web: Dashboard のデータ取得を `WeatherDataCard` / `TrainsDataCard` に抽出しレイアウト層を分離。発車本数はサーバーで既に displayCount にキャップ済みのため、クライアント側の重複 slice を除去。
- web: `DebugOverlay`（440行）を format / useDebugMetrics / SummaryTile / ApiStatsTable / EventHistory / container（142行）に分割。
- web: `SettingsModal`（252行）から天気/電車/路線運行情報セクションを独立コンポーネント化し、既存の Sleep/Display セクションと統一。シェル（62行）に。

### ラウンド2の判断記録

- API リファクタは別エージェント（Sonnet）に旧実装との挙動等価レビューを依頼。7つの重点項目すべて「等価性OK」、低重度2件（`resolveWebDistRoot` の評価タイミング差・dist無し時のreturn）はいずれも運用上の挙動差なしと確認。
- `apps/api/src/departures.ts`（790行）の分割は**見送り**。京王の駅名・行先コード等の文字列リテラルの参照データが大量にあり、テストが無い状態でファイル間を手で移すとタイプミスで挙動を静かに壊すリスクがある（ビルドは型エラーしか検知しない）。安全側に倒して現状維持とした。将来 departures のテストを整備した上で、参照データの分離を行うのが望ましい。

## 検証

`pnpm test` 全 green（web 19 / display-control 15 / api 23）。`pnpm build` 全 green。
