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
