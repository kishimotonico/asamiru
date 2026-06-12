# 設定バックアップ機能

## 目的

[ADR: 設定はクライアント保持のまま、バックアップはエクスポート/インポートで行う](../adr/2026-06-12-client-settings-with-export.md) に従い、localStorage に保存されたクライアント設定を JSON ファイルでバックアップ・復元できるようにする。

## 実装内容

- [x] 各設定 atom の localStorage キーを定数として公開する
- [x] 既知キーだけを扱うバックアップ生成・検証・適用処理を追加する
- [x] 設定モーダルにバックアップのエクスポート・インポート UI を追加する
- [x] ユーティリティのテストを追加する
- [x] web テストと通常・デモビルドを検証する

## 設計メモ

- バックアップ内の設定値は localStorage の JSON 文字列を parse した JSON 値として保持する
- インポート時は値を `JSON.stringify` し、既存の `atomWithStorage` と同じ保存形式で localStorage に書き戻す
- 未知キーは将来・他環境由来の項目として無視するが、既知キーが1件もないファイルは拒否する

## 検証結果

- `pnpm --filter web test`: 11ファイル、117テスト成功
- `pnpm --filter web build`: 成功
- `VITE_DEMO_MODE=true pnpm --filter web build`: 成功

## コードレビュー（2026-06-12）

- [ ] インポート時に各設定値のスキーマを検証し、不正値を localStorage に保存しない
- [ ] バックアップに含まれない既知キーは削除し、エクスポート元のデフォルト状態まで復元する
- [ ] エクスポート時の JSON 解析・ダウンロード生成エラーを UI に表示する

確認結果: `pnpm --filter web test`（117件）と `pnpm --filter web build` は成功。

## コードレビュー対応（2026-06-12）

- [x] 各設定 atom に、トップレベルの欠落を許容しつつ存在する値と配列要素を検証する型ガードを追加した
- [x] 設定キーと型ガードをレジストリ化し、全値の検証・JSON直列化後に既知キーを全削除してバックアップ値を書き戻すようにした
- [x] 空の `settings` を全設定のデフォルト復帰として受理し、未知キーのみのバックアップは引き続き拒否するようにした
- [x] エクスポート処理の例外を捕捉し、インポートエラーと同じ設定フィールド内へ表示するようにした
- [x] 不正な `sleep.windows` / `calendar.icsUrls`、全置換、空設定、部分書き込み防止、エクスポートエラー表示のテストを追加した

変更ファイル:

- `apps/web/src/settings/weatherSettingsAtom.ts`
- `apps/web/src/settings/trainsSettingsAtom.ts`
- `apps/web/src/settings/calendarSettingsAtom.ts`
- `apps/web/src/sleep/sleepSettingsAtom.ts`
- `apps/web/src/theme/themeAtom.ts`
- `apps/web/src/settings/settingsBackup.ts`
- `apps/web/src/settings/BackupSettingsSection.tsx`
- `apps/web/src/settings/settingsBackup.test.ts`
- `apps/web/src/settings/BackupSettingsSection.test.ts`

検証結果:

- `pnpm --filter web test`: 12ファイル、123テスト成功
- `pnpm --filter web build`: 成功
- `VITE_DEMO_MODE=true pnpm --filter web build`: 成功
