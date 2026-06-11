# GitHub Pages デモ実装

## 概要

リポジトリ公開に合わせて、サーバーなしで動く GitHub Pages デモを実装した。
公開先: `https://kishimotonico.github.io/asamiru/`

## 方針

- 天気（Open-Meteo）はブラウザから直接叩く公開 API なので素通し
- 鉄道・モニター連動は MSW（Mock Service Worker）で横取りして固定データを返す
- `VITE_DEMO_MODE=true` のときのみ MSW が有効になり、通常ビルド・本番に影響なし

## 実装内容

### 追加依存
- `msw@2.14.6`（`apps/web` devDependencies）

### 新規ファイル
- `apps/web/src/mocks/handlers.ts` — MSW ハンドラー。鉄道・モニター API を横取り
  - `POST */api/rail/departures` → 現在時刻起点のダミー発車時刻を返す
  - `POST */api/rail/line-status` → リクエスト body の `lines` を基準に応答を組み立て（設定 UI と整合）、先頭1件だけ `warn`
  - `GET */api/system/display` → `{ enabled: false }`（connectWithRetry がリトライなし終端）
- `apps/web/src/mocks/browser.ts` — MSW worker のセットアップ
- `apps/web/public/mockServiceWorker.js` — MSW 提供の SW スクリプト（`msw init` で生成）
- `apps/web/src/controls/DemoBadge.tsx` — 左下に固定表示される控えめな "DEMO" バッジ
- `.github/workflows/deploy-demo.yml` — GitHub Actions で build/deploy を2ジョブに分離

### 変更ファイル
- `apps/web/src/main.tsx` — MSW を await してから render（SW 起動前に React Query が走らない構造を保証）。失敗時は実 API にフォールバックせずエラー表示
- `apps/web/vite.config.ts` — `base: process.env.VITE_BASE_PATH ?? "/"` を追加
- `apps/web/src/vite-env.d.ts` — `VITE_DEMO_MODE` を型定義に追加
- `apps/web/src/App.tsx` — `VITE_DEMO_MODE === "true"` のとき `DemoBadge` をレンダー

## レビュー対応（2026-06-04-github-pages-demo-plan-review.md）

Claude レビューの5件をすべて取り込んだ:

1. **pnpm セットアップ** → `pnpm/action-setup v4`（version: 11.0.6）+ `--frozen-lockfile`
2. **ジョブ分離** → build/deploy を2ジョブに分け、deploy に `needs: build` と `environment: github-pages`
3. **MSW 失敗時のフォールバック禁止** → start が reject したら最小エラー画面を出して throw
4. **SW 起動の可用性境界** → `worker.start()` await 後に `render()` を呼ぶ構造で保証
5. **line-status の UI 整合** → request body の `lines` を使い、設定変更が追従するように

## 初回デプロイに必要な手動操作

GitHub リポジトリの Settings → Pages → Source を **"GitHub Actions"** に変更する必要がある（1回のみ）。

## ローカル検証

```sh
VITE_DEMO_MODE=true pnpm --filter web dev
```

→ `http://demo-ghpage.asa.localhost:1355`（worktree URL）でアクセスして確認。
