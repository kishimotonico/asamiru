# 設定のサーバー保存 実装計画

[プロジェクト分析](2026-06-11-project-analysis.md) の課題6。kiosk のブラウザプロファイルが飛ぶと localStorage の設定（天気地点・乗車駅・監視路線・スリープスケジュール・ICS URL）が消える問題への対応。

## 方針

サーバー側の JSON ファイルを権威とし、localStorage はキャッシュに格下げする。スリープ「意図」はクライアント持ちのまま（[ADR: client sleep intent](../adr/2026-06-03-client-sleep-intent-server-display-state.md) とはレイヤーが別。意図は揮発・設定は永続）。ADR を新規作成すること。

## 設計

### apps/api

- `settingsStore.ts`（新規）: 単一 JSON ファイルの読み書き。パスは `ASAMIRU_DATA_DIR`（既定 `./data`、gitignore 追加）配下の `settings.json`。書き込みは tmp ファイル → rename のアトミック書き。ファイル未存在は `{}` 扱い（初回起動の正常系）。壊れた JSON は throw（隠蔽しない）
- `settingsRoutes.ts`（新規）: `GET /api/settings` → 全設定オブジェクト、`PUT /api/settings` → 全置換保存。ドメイン別パッチは不要（クライアントが全量送る。個人用・設定は小さい）
- 形は `Record<string, unknown>` のままドメイン非依存に保つ（weather / trains / sleep / calendar / theme のスキーマは web 側の知識。API はただの永続化層）

### apps/web

- `settings/serverSettingsStorage.ts`（新規）: jotai の `atomWithStorage` に渡せるカスタム storage。読み: 初期化時に GET した全設定スナップショットから該当キーを返し、localStorage とは「サーバー優先」でマージ。書き: localStorage へ同期書き＋サーバーへ debounce（1秒）した PUT で全量保存
- 起動シーケンス: main.tsx で GET /api/settings を await してから render（rail 系と同様、起動時にサーバーは確実にいる前提。失敗時はエラー表示。ただし**デモビルドだけは** MSW が GET/PUT をモックする）
- 既存の `mergedStorage`（デフォルトとのシャローマージ）の意味論は維持し、サーバー版に組み込む
- 各 `*SettingsAtom.ts` は storage 差し替えのみで型・キー名は不変

### デモ（worktree-demo-ghpage 統合後）

- MSW に GET/PUT /api/settings ハンドラを追加（メモリ保持）。デモの可用性境界が増えるので handlers の網羅を忘れない

## テスト

- api: settingsStore のラウンドトリップ・アトミック書き・壊れたJSONのthrow、ルートのGET/PUT
- web: serverSettingsStorage のサーバー優先マージ・debounce PUT・localStorage キャッシュ整合（happy-dom + fetch モック）

## 注意

- 全量 PUT なので「最後に書いた者勝ち」。複数クライアント同時編集は要件外（個人用1台）
- settings.json には ICS URL が入る。ログに内容を出さない
- `.env.example` / README の更新も忘れない

## 実装記録

- API に JSON ファイル store と GET/PUT ルートを追加した。
- Web に同期 server settings storage を追加し、全設定 atom を差し替えた。
- 起動時 GET、失敗画面、デモ MSW のメモリ保持 GET/PUT を追加した。
- store、routes、サーバー優先マージ、localStorage キャッシュ、debounce PUT のテストを追加した。
- ADR、README、`.env.example`、`.gitignore`、`ARCHITECTURE.md` を更新した。

### 検証結果

- `pnpm test`: 成功
- `pnpm build`: 成功
- `VITE_DEMO_MODE=true pnpm --filter web build`: 成功
- `VITE_DEMO_MODE=true pnpm --filter web test`: 成功（117 tests）
