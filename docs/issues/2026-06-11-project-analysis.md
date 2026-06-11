# プロジェクト分析: 既存仕様・実装の課題と今後の取り組みポイント

2026-06-11 時点のコードベース・ドキュメント全体を読んだ上での棚卸し。個人用ダッシュボードであり仕様変更ウェルカムという前提で、課題を「壊れたら朝困る順」で整理する。

## 現状の評価（良い点）

- 設計ドキュメントの整備度が高い。ARCHITECTURE.md・ADR・sleep-display-spec が実装と一致しており、「既知の割り切り」も明文化されている
- 責務分離が行き届いている。スリープ3フック分離、API のルート分割、AsyncCardBoundary によるカード単位の障害隔離、display-control のドライバ抽象など
- エラーを隠蔽しない方針が一貫している（過度なフォールバック禁止が実際に守られている）
- テストは sleep / display / ルート層は整備済みで全 green（api 23 / web / display-control 15）

## 課題1: テストの空白が「毎日見るロジック」に偏っている

最重要。テストがあるのはスリープ・モニター連動・HTTPルートで、毎朝表示される中核ロジックが無テストのまま。

- `apps/api/src/departures.ts`（784行）: 方向判定・分岐線除外・運行日ロールオーバー・遅延計算・時刻表補完マージ
- `apps/api/src/timetable.ts`: 駅名正規化（NFKC順序の罠あり）・祝日ダイヤ判定
- `apps/web/src/data/weather.ts`: WMO コード変換・6時間ピック
- `CalendarCard` の月組み立て

[テスト計画](2026-06-03-test-coverage-todo.md) は具体的で質が高いが未着手。さらに [リファクタログ](2026-06-04-architecture-refactor.md) で「departures.ts の参照データ分離はテスト整備後」と先送りされており、**テスト不在が他の改善のブロッカー**になっている。

なお同計画は記述が古い: 「テストフレームワークが一切存在しない」→ 現在は vitest 導入済み、`parseYahooTrainInfo` は `index.ts` → `lineStatus.ts` へ移動済み。基盤構築フェーズは丸ごと不要になっているので、着手時はフェーズ1（departures / timetable）から始められる。

## 課題2: 京王データのハードコードと timetable.json の鮮度

- `departures.ts` に駅順序マップ・分岐線駅セット・種別/行先コード表が直書き。ダイヤ改定や駅コード変更で静かに壊れる
- `timetable.json`（5.7MB、generatedAt 2026-06-02）は年1回手動スクレイプ前提。**改定に気づく仕組みがない**
- 未知コードは `種別X` / `行先X` で表示される設計（良い）が、出現してもログに残るだけで気づきにくい

改善案:

- timetable.json の `revision` をリアルタイム側のデータと突合し、不一致なら DebugOverlay / 起動ログで警告する
- 未知の種別/行先コード出現時に debug イベント（`kind: "error"` 相当）を記録して可視化する
- テスト整備後、参照データを `departures.ts` から分離（リファクタログで合意済みの方向）

## 課題3: 外部依存がすべて非公式・スクレイピング

- 運行情報: Yahoo!路線情報の HTML 構造（`#mdServiceStatus`）依存
- 発車情報: opentidkeio の非公式 JSON（フィールド名 `tr`/`sy`/`ki` など無保証）
- 天気: Open-Meteo（これは公式 API なので低リスク）

構造変更時は throw → カードにエラー表示、という設計は方針どおりだが「朝壊れて初めて気づく」体験になる。パース失敗時に受信 HTML/JSON の先頭をログへ残すと、復旧時の差分調査が一気に楽になる。中長期では公共交通オープンデータセンター（ODPT）の京王データへの乗り換えも検討余地。

## 課題4: サーバー時刻のタイムゾーン暗黙依存

`serviceDateKey` / `currentServiceDayMinutes`（departures.ts）と `selectDiakind`（timetable.ts）はサーバーのローカルタイムに依存する。Raspberry Pi が JST 設定なら動くが、TZ 未設定環境では運行日判定が静かにずれる。weather 側は `timezone=Asia/Tokyo` を明示しているのと非対称。起動時に `Intl.DateTimeFormat().resolvedOptions().timeZone` をチェックして JST 以外なら警告する、程度の安全装置が手頃。

## 課題5: カレンダーの「予定」がプレースホルダー

`CalendarCard` の予定欄は「予定なし」固定。朝見るダッシュボードとして一番価値が伸びる未実装機能。Google Calendar API（OAuth が重い）より、**ICS の非公開 URL をサーバー側で取得・キャッシュ**する方が既存の rail 系と同じパターン（API が取得・正規化、Web は POST で受ける）に乗せられて自然。

## 課題6: 設定の localStorage 単一保存

設定はブラウザの localStorage のみ。kiosk のブラウザプロファイルが飛ぶ・ブラウザを変えると設定が消える。個人用の割り切りとしては成立しているが、サーバー側に JSON で永続化して localStorage をキャッシュ扱いにする選択肢はある（ADR の「intent はクライアント」とは別レイヤーの話）。優先度は低め。

## 課題7: 小さい棚卸し

- `ccusage.json` がルートに未追跡で残っている。リポジトリの成果物ではないので `.gitignore` 追加が妥当
- `docs/issues/2026-06-04-github-pages-demo-plan-review.md` も未追跡。docs/issues はコミットする方針なのでコミット対象
- GitHub Pages デモ化は計画レビュー済み・未実装。レビュー指摘（pnpm セットアップ明示・MSW 起動失敗時の表示・line-status モックは body の lines を反映）を踏まえて実装すれば完成度高くできる
- フック結合テスト（useSleepController の合成layer）はリファクタログの残課題のまま。純粋関数テストで主要ロジックは押さえているので優先度低

## 実施記録（2026-06-11 同日完了）

本ドキュメントの全課題を同日に解消した。テスト 0→250件（api 118 / web 117 / display-control 15）。

- テスト全フェーズ: `e4cd55c` `97ce81d`、フック結合テスト: `2446f2a`
- 鮮度警告・未知コード可視化・TZチェック: `b5d4902`
- 参照データ分離（departures.ts 851→707行）: `51ad80e`
- ICS カレンダー予定連携: `c74812b`（計画 [ics-calendar-plan](2026-06-11-ics-calendar-plan.md)）
- GitHub Pages デモブランチ統合: `ef71950`（デモは worktree-demo-ghpage に実装済みだったものを main へ統合）
- 設定サーバー保存: `adfe4c8`（計画 [server-settings-plan](2026-06-11-server-settings-plan.md)、ADR あり）
- git 整理（ccusage.json ignore ほか): `17ceb8d`

## 推奨ロードマップ

1. **テスト フェーズ1**（departures / timetable）— 他の改善のブロッカー解除。計画書が既にあるので着手コストは低い
2. **timetable.json の鮮度警告 + 未知コード可視化** — 「静かに壊れる」を「気づける」に変える小工数の改善
3. **departures.ts の参照データ分離** — テスト整備後に安全に実施
4. **カレンダー予定連携（ICS）** — 機能面で最も価値が伸びる
5. **テスト フェーズ2/3**（weather / 運行情報パーサー / mergedStorage）
6. GitHub Pages デモ、TZ 起動チェック、設定のサーバー保存は気が向いたときに
