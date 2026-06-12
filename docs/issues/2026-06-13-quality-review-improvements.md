# 設計・コード品質レビューと改善の実施

2026-06-12 にコードベース全体（apps/api・apps/web・packages）の設計・アーキテクチャ・コード品質をレビューし、指摘事項を翌13日にかけて全て実装した。ブランチは `refactor/quality-improvements`（main に `4a87a17` が push されたため、その上にリベース済み）。

## レビューの総評

機能コードの設計は健全。ARCHITECTURE.md・ADR と実装が一致し、責務分離（スリープ3フック・ドライバ抽象・カード単位の障害隔離）も徹底されていた。指摘は「プロセスの穴（CI・lint）」と「一貫性の綻び」に集中した。

## 実施内容

### コミット1: API のエラーハンドリング統一と TTL キャッシュ集約

- `BadRequestError` を導入し、`calendarRoutes` のエラーメッセージ文字列マッチによる 400/502 振り分け（メッセージ変更で静かに 502 化する脆い実装）を `instanceof` 判定に置換
- `railRoutes` の2つの POST で未ガードだった `c.req.json()` を try/catch し、不正 JSON を 400 で返す（従来は 500）
- `app.ts` にグローバル `onError` を追加（`/api/*` は JSON、それ以外は text で 500）
- ブラウザがキャッシュしない POST レスポンスの `Cache-Control` 3箇所を削除
- 4箇所の手書き TTL キャッシュ（departures の traffic/dia・lineStatus・calendar）を `ttlCache.ts` の `createTtlCache` に集約。in-flight 共有が全キャッシュに広がり、debug イベントの粒度も統一。departures.ts は 707→約600行に
- `TrainCandidate` 型を timetable.ts に一本化（buildScheduleCandidates の構造コピーを解消）
- `DELETE /api/calendar/cache` を追加（line-status と対称に）
- `withUpstream` の「失敗時に upstream_request + error の2イベント」が !ok 時の呼び出し側パターンと整合する意図的設計であることを doc コメントで明文化

### コミット2: Web の型ガード集約と天気デモ設定のカタログ化

- `isRecord` / `hasOwn` / `isNumber` の5ファイル13重複定義を `lib/guards.ts` に集約
- `weather.ts` がデモ用にレスポンスの `_location` フィールドを読む実装（MSW ハンドラが「キヴォトス」を注入）を除去。デモ地名は鉄道と同じ設定カタログ（`settings/catalog/` の VITE_DEMO_MODE ビルド時切替）で供給する方式に統一
- 天気デフォルト（座標・地名）をカタログへ移し、`fetchWeather` のハードコードデフォルトを削除（設定経由に一本化）。デモの localStorage key も本番と分離
- カタログが鉄道専用でなくなったため alias を `#settings-catalog-active` に改名

### コミット3: ESLint と CI の導入

- ESLint flat config（typescript-eslint recommended + react-hooks）を導入。**従来は ESLint 未導入なのに `eslint-disable` コメントが存在する状態**だった
- `exhaustive-deps` を error で有効化した結果、実際の依存漏れを1件検出（`useSleepIntent` の resync Effect に `awakeMs`。settings 由来の導出値なので発火タイミングは不変）。形骸化していた disable コメント3件は全て除去できた
- `eslint-plugin-react-hooks` v7 は React Compiler 系ルール約17個を含むが、本タスクの範囲を超えるため classic の2ルール（rules-of-hooks / exhaustive-deps）のみ採用。Compiler 対応は将来の別タスク
- `ConnectionResult` の接続状態リテラル直書きを `DisplayConnection` 型に統一
- `.github/workflows/ci.yml` を新設（push to main / PR で lint → build → test）。**従来テスト259件は CI で一度も実行されていなかった**
- `deploy-demo.yml` にもビルド前のテストゲートを追加

## レビュー時に「現状維持」と判断したもの

- `selectDesiredSleeping` の now が tick 間隔15秒の粒度であること（仕様内）
- DebugOverlay 集計で upstream 失敗が request + error の2イベントに見えること（意図的設計として doc コメント化で対応）

## 検証

- `pnpm lint`: 0 errors / 0 warnings
- `pnpm build`: 全パッケージ成功
- `pnpm test`: 259件全パス（api 115 / web 129 / display-control 15）

## 実施体制

レビューと統合は Fable、実装はサブエージェント3本（API / Web / lint+CI）に分担。A・B は並行実行、C は A・B 統合後に実施。
