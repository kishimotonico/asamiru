# スリープ機能とフルスクリーン化の実装

計画: `docs/plans/purring-fluttering-tome.md`
レビュー: `docs/issues/2026-06-03-sleep-feature-plan-review.md`（Codex 2回 ＋ 設定特別扱い廃止の指摘を反映）

## 背景

リビング常設モニターのダッシュボードを「見たいときだけ」表示し、それ以外は画面を暗くして外部APIリクエストも止めたい。モニターは普段操作しないため無操作タイマー（idle検知）は使わず、スケジュール（曜日ごと＋複数時間帯）＋手動操作で制御する。

## 実装方針

スリープを単なる暗転UIではなくアプリ状態として扱い、**スリープ中は Dashboard を条件付きアンマウント**してデータ取得サブツリーごと外す。これで定期ポーリングだけでなく初回 fetch も止まり、`ClockCard` の1秒 interval もアンマウントで自然停止する（`dashboardQueries.ts`/`ClockCard.tsx`/`Dashboard.tsx` は無改修）。

状態は最小化：永続の `SleepSettings`（enabled / windows / manualWakeDurationMin）＋ 実行時の `awakeUntil`（操作で延長される起床期限、初期値0）＋ `suppressInputUntil`（復帰直後のフルスクリーン誤発火抑止）。判定は純粋計算：

```
sleeping = scheduleSleeping(now) && now >= awakeUntil
scheduleSleeping(now) = enabled && windows.length>0 && !scheduleAwakeNow(now, windows)
```

override union や境界時刻計算は持たず、`awakeUntil` が時刻で自然失効するため失効バグが構造的に起きない。設定画面の特別扱い（`!settingsOpen`）はやめ、設定操作も通常のアクティビティ延長として吸収（編集中は起きたまま／放置すれば寝てモーダルごと閉じる。設定は即時 localStorage 反映済みで損失なし）。

## 操作仕様

- 復帰: スリープ中の `keydown`/`pointerdown` で即復帰（`mousemove` は微小イベント誤復帰防止のため除外）。復帰直後300msは入力抑止
- 手動スリープ `s`: 一時起床を今すぐ打ち切る（`awakeUntil=now`）。起床時間帯の「中」では効かない（仕様上の割り切り）
- フルスクリーン: `f` キー／空白部分ダブルクリックでトグル（ボタン・入力・モーダル上では無効）

`awakeUntil` を変える操作では `now` state も同時刻に揃え、`now>=awakeUntil` の描画判定が tick(15秒)を待たず即反映されるようにした。

## 追加・変更ファイル

新規:
- `apps/web/src/sleep/sleepSettingsAtom.ts`（型・既定値・純粋関数 `scheduleAwakeNow`/`scheduleSleepingNow`）
- `apps/web/src/sleep/useSleepController.ts`（状態統括・操作リスナ・StrictMode対策で最新値は ref 参照）
- `apps/web/src/sleep/useFullscreen.ts`
- `apps/web/src/sleep/SleepScreen.tsx`（黒背景＋低輝度時計、1分粒度）
- `apps/web/src/settings/SleepSettingsSection.tsx`（曜日トグル＋時間帯＋自動スリープ分）
- `apps/web/src/lib/dom.ts`（`isTextInputTarget` 共通化、`DebugOverlay` から移設）

変更:
- `apps/web/src/App.tsx`（`useSleepController` ＋ `SleepScreen`/`Dashboard` 条件付きレンダー）
- `apps/web/src/settings/SettingsModal.tsx`（スリープセクション差し込み）
- `apps/web/src/debug/DebugOverlay.tsx`（共通 `isTextInputTarget` を利用）
- `apps/web/src/index.css`（`:root` に `--accent` を定義。headlessui の Dialog は body 直下 portal にレンダーされ `<main>` の `--accent` を継承できず、モーダル内の accent 色が出ない潜在バグを修正）

既定スケジュール: 平日 06:00-09:00、自動スリープ15分、enabled。

## 検証（agent-browser ＋ ロジックテスト）

- 初回ロードがスリープ帯 → 黒画面＋低輝度時計、`/api/*`・open-meteo の初回リクエストが0件
- キー/ダブルクリックで復帰 → Dashboard 表示、復帰時に発車案内・天気・運行情報を取得
- `s` で即スリープ（16秒後も維持）
- 自動スリープタイマー（1分設定）：起床→無操作→スリープへ遷移を確認
- `f`／空白ダブルクリックでフルスクリーン ON/OFF、スリープ中の復帰ダブルクリックでは FS 誤発火なし（300ms抑止）
- スリープ設定UI表示（曜日 accent 色）。`--accent` portal 問題の修正を確認
- `scheduleAwakeNow` のアルゴリズム単体検証 10/10（日付またぎ 22:00-06:00、前日窓の朝側継続、終端排他、start===end無視、23:59-00:01ラップ、空windows）
- `pnpm --filter web build`（tsc -b ＋ vite build）成功

## 追記: Codex レビュー指摘の修正

- 全曜日OFF（`days: []`）や無効時刻のみの時間帯が「空スケジュール」扱いにならず常時スリープになる問題を修正。`isEffectiveWindow`（曜日1つ以上＋有効な時刻幅）を追加し、`scheduleSleepingNow` のガードを `windows.length > 0` から `windows.some(isEffectiveWindow)` に変更。有効な起床時間帯が1つも無ければ自動スリープ無効。
- `manualWakeDurationMin` 変更が現在の `awakeUntil` に即反映されない問題を修正。`useSleepController` に設定変更を監視する effect を追加し、スリープ帯で一時起床中のときのみ `awakeUntil = now + 新しい分` に寄せる。
- 検証: `scheduleSleepingNow` のロジック 6/6（通常・全曜日OFF・空windows・無効時刻のみ・enabled=false・有効窓混在）、`tsc -b` 成功。

## 未対応 / 今後

- 起床時間帯の「中」での手動スリープは非対応（必要なら別途）
- スリープ判定のユニットテストは未追加（vitest 未導入。`docs/issues/2026-06-03-test-coverage-todo.md` の方針に従い純粋関数化のみ）
