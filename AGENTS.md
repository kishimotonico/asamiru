# AGENTS.md

## Gitルール

- コミットメッセージは日本語・Conventional Commits形式で（例: `feat: プロジェクト一覧画面を追加`）
- `git -C` オプションは使用禁止

## 注意事項

- 仕様・設計ドキュメントは `docs/` に適宜整理する
- ADRを `docs/adr/` に保存する
- Claude CodeやCodexは `docs/issues/yyyy-mm-dd-summary-description.md` に作業内容を読み書きする

## 実装方針

- 場当たり的、その場しのぎの修正は禁止。工数がかかっても本質的な解決策を実装する
- 過度なフォールバックは禁止。エラーは正しくハンドリングし、問題を隠蔽しないこと

## デバッグ方法

- ブラウザを使ったデバッグは agent-browser を使う
- 開発サーバーは `pnpm dev` で、http://asa.localhost:1355がアクセス先

