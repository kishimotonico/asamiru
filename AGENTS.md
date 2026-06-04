# AGENTS.md

## Gitルール

- コミットメッセージは日本語・Conventional Commits形式で（例: `feat: プロジェクト一覧画面を追加`）
- `git -C` オプションは使用禁止

## 注意事項

- 仕様・設計ドキュメントは `docs/` に適宜整理する
- ADRを `docs/adr/` に保存する
- Claude CodeやCodexは `docs/issues/yyyy-mm-dd-summary-description.md` に作業内容を読み書きする

## 実装方針

- 過度なフォールバックは禁止。エラーは正しくハンドリングし、問題を隠蔽しないこと
- 互換性は重視しないため、破壊的変更もOK。適切な設計・実装を重視する
- 既存仕様や要件も柔軟に変更OK。必要に応じて仕様を見直し、より良い設計を追求する
- 場当たり的、その場しのぎの修正は禁止。工数がかかっても本質的な解決策を実装する
- フロントエンド（`apps/web`）の見た目・操作系を触るときは `docs/frontend-design.md` に従う（カラートークン・テーマ・オーバーレイ・motion・カーソル等の規約）

## デバッグ方法

- ブラウザを使ったデバッグは agent-browser を使う。それ以外は必要なときのみ
- 開発サーバーは別のシェルで起動済みのことが多いので、`pnpm dev`を実行せず直接アクセスしてOK
- アクセスURLは `http://asa.localhost:1355` または `http://<worktree-branch-name>.asa.localhost:1355`。IPアドレスによるアクセスは不可
