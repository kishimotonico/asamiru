# GitHub Pages デモ化プランレビュー

対象: `~/.config/claude/plans/giggly-giggling-charm.md`

## Findings

1. Actions の pnpm セットアップが未定義
   - プランは `pnpm install` から始めるが、GitHub hosted runner に `pnpm@11.0.6` がある前提を置いている。
   - `package.json` の `packageManager` は `pnpm@11.0.6` なので、`pnpm/action-setup` または `corepack enable` と `actions/setup-node` を明示する必要がある。
   - これはテスト不足ではなく、デプロイ手順が runner の偶然の状態に依存する欠陥。`pnpm install --frozen-lockfile` まで含めて固定するべき。

2. Pages deploy job の `needs` / `environment` がプランに明記されていない
   - GitHub Pages artifact 方式は build と deploy を分けるなら deploy job に `needs: build` と `environment: github-pages` を置くのが公式例と整合する。
   - 単一 job にする場合も upload 後に deploy する順序を明確にする必要がある。ここが曖昧だと artifact を作る責務と公開する責務が混ざり、失敗時の切り分けが難しくなる。

3. MSW 起動失敗時の扱いが曖昧
   - `enableMocking().then(render)` だけだと、デモモードで Service Worker 登録に失敗した場合に画面が描画されず、利用者には原因が見えにくい。
   - デモは MSW が必須なので、黙って本物 API にフォールバックするのではなく、最小限のエラー表示または明示的な throw/log を設計に入れるべき。

4. デモ時の `/api/...` は GitHub Pages のプロジェクトパス外へ出る
   - production build の `apiEndpoint()` は `/api/...` を返す。Pages の `https://kishimotonico.github.io/asamiru/` から見ると、通常の fetch 先は `https://kishimotonico.github.io/api/...` になる。
   - MSW が横取りできるため成立する設計ではあるが、デモの API 成功条件が「SW が確実に起動してから最初の API fetch が走ること」に完全依存する。
   - そのため main の bootstrap は単なる便利機能ではなく、デモの可用性境界。失敗時の表示と、`worker.start()` 完了前に React Query が走らない構造を明確に守るべき。

5. 運行情報モックが設定 UI と食い違う可能性がある
   - プランは `POST /api/rail/line-status` で固定の `京王線` / `中央線` などを返すとしている。
   - ただし実アプリには監視路線の変更 UI があり、リクエスト body には `watchedLines` が入る。
   - デモで設定を変えても運行情報が固定路線のままだと、設定 UI が壊れているように見える。固定デモでよいとしても、body の `lines` を基準に `name` / `sourceUrl` を返し、そのうち1件だけ `warn` にする方が本質的に自然。

## Notes

- `/api/system/display` を `{ enabled: false }` で返せばリトライせず SSE も購読しない、という前提は `connectWithRetry` と `DisplayInfoResponse` の型に合っている。
- `apiEndpoint()` は production build では相対 `/api/...` を返すため、GitHub Pages 上で MSW の `*/api/...` ハンドラに寄せる方針は妥当。
- `VITE_DEMO_MODE` と `VITE_BASE_PATH` は `vite-env.d.ts` に足すと実装意図が明確になる。
- ローカル検証では `pnpm --filter web exec pwd` が `apps/web` を返すため、`pnpm --filter web exec msw init public --save` は `apps/web/public` を対象にできる。
