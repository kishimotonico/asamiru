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

- `DebugOverlay` が1ファイル440行と大きい。テーブル/詳細/フォーマッタの分割余地あり（今回は表示専用で挙動リスクが低いため見送り）。
- モジュールON/OFF（表示カードの有効化切替）は未実装。必要になった時点で設計する。
- web 側はフックの結合テスト（React Testing Library）が無い。純粋関数のテストで主要ロジックは押さえたが、フック合成の回帰検知は手薄。

## レビュー

sleep 再設計の挙動等価性を別エージェント（Sonnet）に旧実装との差分でレビューさせた。重大度「高/中」の等価性破壊はゼロ、「低」4件のみ（いずれも動作バグではなく、コメント明示の推奨やコスト微増）。指摘のうち価値の高い2点（外部OFF時の `now` 更新の意図的差分、`resyncAwake` の二段ゲートの説明）をコメントで明示した。残り2件（logger の per-call localStorage アクセス、`actions` の useMemo 依存）は現状の使用箇所では無害なため見送り。

## 検証

`pnpm test` 全 green（web 19 / display-control 15 / api 16）。`pnpm build` 全 green。
