# スリープ機能とフルスクリーン化の追加

## Context

asamiru のダッシュボードはリビングのモニターに常時表示しておくものではなく、朝の身支度時間や昼の外出前など「見たいときだけ」表示する。それ以外の時間帯は画面を暗くし、外部APIへのリクエスト（天気・発車案内・運行情報のポーリング）も止めたい。

現状は天気・発車案内・運行情報が `refetchIntervalInBackground: true`（`apps/web/src/dashboard/dashboardQueries.ts`）で常に回り続けるため、画面だけ暗くしても本質的にはスリープにならない。そこでスリープを「単なる暗転UI」ではなく **アプリ状態（`sleeping`）** として扱い、`sleeping` のときはデータ取得サブツリー（Dashboard）自体をアンマウントしてリクエストを根本から止める。

制約: モニターはリビングに置いてあるだけで普段は操作しないため、**無操作タイマー（idle検知での自動スリープ）は使わない**（＝起床時間帯の間は無操作でも起きっぱなし）。また Web アプリから物理的にモニター電源は切れないため「画面OFF」は黒背景＋低輝度の時計表示＋データ取得停止で実現する。

本プランは Codex の2回のレビュー（`docs/issues/2026-06-03-sleep-feature-plan-review.md`）を反映済み。さらに「設定画面を特別扱い（`!settingsOpen`）するのは不自然」というユーザー指摘を受け、設定画面の操作も含めた**一律のアクティビティ延長**で吸収する形に簡素化した（設定モード廃止）。状態は `awakeUntil` タイムスタンプ中心の最小モデル。

## 決定事項（ユーザー確認済み）

- 切替方式: スケジュール（曜日ごと＋複数時間帯の「起きてる時間帯」）＋手動
- スリープ中表示: 黒背景に低輝度の時計のみ（更新は1分粒度）
- フルスクリーン: 空白部分のダブルクリック＋キー（`f`）
- 手動起動後（起床時間帯の外）: 一定時間（既定15分・設定可）で自動スリープ。操作のたびタイマー延長。加えて「今すぐ寝かせる」ショートカットキー（`s`）
- スケジュール粒度: 曜日ごと＋複数時間帯
- 時刻判定は純粋関数に分離して日付またぎ（22:00-06:00 等）を正しく扱う。vitest 導入は今回見送り（`docs/issues/2026-06-03-test-coverage-todo.md` の保留方針に従い手動検証。純粋関数化のみ）
- 設計のための仕様変更は許容。今回は「設定画面中はスリープしない」専用モードを設けず、通常のアクティビティ延長に統合

## 状態モデル（最小）

override union・baseAwake スナップショット・境界時刻計算・設定モードは使わない。状態は次の最小集合だけ。

```ts
type SleepWindow = { id: string; days: number[]; start: string; end: string }; // days: 0(日)-6(土), "HH:MM"
type SleepSettings = {
  enabled: boolean;              // スケジュール自動制御のON/OFF
  windows: SleepWindow[];        // 起きてる時間帯（awake windows）
  manualWakeDurationMin: number; // 操作後に自動スリープへ戻るまでの分（既定15）
};
// 実行時状態（永続化しない、コントローラ hook 内に保持）
//   awakeUntil: number          操作で延長される起床期限(ms)。これを過ぎ、かつスケジュール上スリープ帯なら寝る
//                               初期値は 0（過去時刻）。初回ロードがスリープ帯なら即スリープさせるため（Codex 指摘1）
//   suppressInputUntil: number  復帰直後の入力抑止期限(ms)。フルスクリーン誤発火防止のみに使用
```

判定（純粋計算）:

```
scheduleSleeping(now) = settings.enabled && settings.windows.length > 0
                        && !scheduleAwakeNow(now, settings.windows)
sleeping(now) = scheduleSleeping(now) && now >= awakeUntil
```

- `settings.windows.length === 0` のときは自動スリープしない（空スケジュールで永遠に寝るフットガン回避）。
- 起床時間帯の中（`scheduleAwakeNow=true`）は `scheduleSleeping=false` なので無操作でも常に起床。タイマーは働かない（無操作タイマー不使用の要件を満たす）。
- 起床時間帯の外では、最後の操作から `manualWakeDurationMin` 経過で自動スリープ。操作のたび `awakeUntil` 延長。
- 設定画面の操作も通常のアクティビティとして `awakeUntil` を延長するため、編集中は自然に起きたまま。開いたまま放置すれば（操作が止まれば）通常どおりスリープへ入る＝設定画面専用の特別扱いは不要。

このモデルでは override が存在せず、`awakeUntil` が時刻で自然失効するため「古い状態が次の起床帯で復活する」失効バグが構造的に起きない。

### 手動スリープ `s` の意味と制限

`s` は「今すぐ寝かせる＝一時起床を打ち切る」操作で、`awakeUntil = now` にする（＝即失効）。スケジュール上スリープ帯で一時起床中なら即スリープ。ユーザーの要望（昼の外出前に手動起動 → 15分待たず即スリープ）を満たす。`s` 自体は通常のアクティビティ延長の対象外（延長させると寝られないため）。

制限: 起床時間帯の「中」では `scheduleSleeping=false` のため `s` は効かない。起床帯の中で強制的に寝かせたい要求が出たら別途対応（今回はスコープ外）。

## 時刻判定の純粋関数（日付またぎ対応）

`scheduleAwakeNow(now: Date, windows: SleepWindow[]): boolean` を純粋関数で実装。各 window について:
- `t = now の分(0-1439)`、`d = now.getDay()`、`s = start分`、`e = end分`
- `s === e` の窓は長さ0として無視
- 非ラップ（`s < e`）: `d ∈ days && s <= t < e`
- ラップ（`s > e`、例 22:00-06:00）: 開始日基準で
  - 夜側: `d ∈ days && t >= s`
  - 朝側: `((d + 6) % 7) ∈ days && t < e`（前日の窓の継続分）
- どれか1つでも該当すれば起床。

境界仕様をこの関数に集約し、コンポーネントへ条件式を散らさない。`22:00-06:00` / `00:00-04:00` / `23:59-00:01` / `start===end` を想定。テストは vitest 導入時（test-coverage TODO）に追加。

## App の構成（条件付きレンダー）

スリープ中は Dashboard をアンマウントする。SettingsModal は Dashboard 内のまま（設定モードを廃止したので App へ持ち出す必要はない）。

```tsx
function App() {
  const { sleeping, now } = useSleepController();
  return (
    <>
      {sleeping ? <SleepScreen now={now} /> : <Dashboard />}
      {import.meta.env.DEV && <DebugOverlay />}
    </>
  );
}
```

- スリープ中は `Dashboard` が無いので `useSuspenseQuery` フックが呼ばれず、**初回 fetch も定期ポーリングも発生しない**（Codex 指摘1・6）。`ClockCard` の1秒 interval もアンマウントで自動停止。
- 復帰時は `Dashboard` 再マウントでクエリ再購読。`staleTime`（=各ポーリング間隔）を過ぎていれば自然に refetch、キャッシュ gc 済み（長時間スリープ）なら Suspense フォールバックを挟んで取得。明示的な `invalidateQueries` は不要。
- 設定画面を開いたまま放置 → 操作が止まれば自動スリープ → Dashboard ごと（開いていた SettingsModal も）アンマウント。設定は即時 localStorage 反映済みなので損失なし。復帰時は通常のダッシュボードから。

## 新規ファイル（`apps/web/src/sleep/`）

- `sleepSettingsAtom.ts` — `SleepSettings` 型・既定値・`atomWithStorage`（key: `asamiru-sleep-settings`、既存 `apps/web/src/settings/mergedStorage.ts` 再利用、`getOnInit: true`）。純粋関数 `scheduleAwakeNow` もここに置く。
- `useSleepController.ts` — App に1つだけマウントする統括 hook:
  - `now` を `useState`＋`setInterval`（15秒）で更新（マウント時即時）。`awakeUntil` / `suppressInputUntil` を保持
  - `sleeping` と `now` を返す（`settings` は atom から購読）
  - window へ capture-phase で `keydown` / `pointerdown` / `touchstart` を登録（`mousemove` は含めない＝微小イベントでの誤復帰防止、Codex 指摘5）。操作ハンドリングは下記
  - フルスクリーン（`f`／ダブルクリック）も担当（`useFullscreen` を利用。※実装はフェーズ2へ分離、下記「実装順」）
  - StrictMode 対策（Codex 指摘3）: listener / interval は1回だけ登録し cleanup を確実に。ハンドラ内で参照する最新の `sleeping` / `settings` / `awakeUntil` / `suppressInputUntil` は `useRef` 経由で読み、stale closure と二重登録を避ける（登録する `useEffect` の依存は空配列にし、値はマウント時に1度だけ張った listener から ref で参照）
- `useFullscreen.ts` — `document.documentElement.requestFullscreen()` / `document.exitFullscreen()` トグルと現在状態。
- `SleepScreen.tsx` — `fixed inset-0 z-[10001] bg-black`、中央に低輝度（`text-white/20` 程度）の時計（HH:MM、秒なし）。`now`（分粒度）から描画。復帰は window の capture listener が拾うため専用ハンドラ不要。

`isTextInputTarget`（現在 `apps/web/src/debug/DebugOverlay.tsx:439`）は `apps/web/src/lib/` 等へ切り出して再利用。

## 操作ハンドリング

window capture-phase の単一ハンドラ群で処理する。

- 復帰直後の抑止（Codex 指摘4）: スリープから復帰した瞬間に `suppressInputUntil = performance.now() + 300` を立て、その間の `click`/`dblclick`/`keydown` はフルスクリーン・手動スリープへ渡さない（capture と synthetic event の順序差で漏れるため状態で抑止）。
- スリープ中（`sleeping === true`）: 任意の `keydown`/`pointerdown`/`touchstart` で `awakeUntil = now + manualWakeDurationMin` にして復帰し、その入力は消費（上記抑止を立てる）。
- 起床中:
  - `s`: 今すぐ寝かせる（`awakeUntil = now`）。アクティビティ延長はしない。入力中（`isTextInputTarget`）・ダイアログ内では無視
  - `f`: フルスクリーントグル（`suppressInputUntil` 経過後のみ）。延長対象
  - ダブルクリック: フルスクリーントグル。`target.closest('button, input, select, textarea, a, [role="dialog"]')` の場合は無視（カード・モーダル誤爆防止）。空白部分で発動。延長対象
  - 上記以外の `keydown`/`pointerdown`/`touchstart`（設定画面内の操作含む）: `awakeUntil = now + manualWakeDurationMin` に延長
- フルスクリーン API はユーザー操作起点が必須のため、必ず `keydown`/`dblclick` ハンドラ内から呼ぶ。
- 設定導線: 復帰後に `ClockCard` の設定ボタンから開く。スリープ画面に専用ボタンは設けない。

## 既存ファイルの変更

- `apps/web/src/App.tsx` — 上記「App の構成」に差し替え。`useSleepController` 呼び出し、`SleepScreen`/`Dashboard` の条件付きレンダー。
- 新規 `apps/web/src/settings/SleepSettingsSection.tsx` — スリープ設定セクション:
  - スケジュール自動制御 ON/OFF（`enabled`）
  - 起床時間帯リスト: 各行＝曜日トグル（日〜土）＋開始（`<input type="time">`）＋終了＋削除。「時間帯を追加」ボタン
  - 操作後に自動スリープへ戻るまでの時間（分、`manualWakeDurationMin`）
  - 既存 `apps/web/src/settings/components/FormControls.tsx` の `SettingField`/`TextInput`/`SelectInput`/`ActionButton` を再利用
- `apps/web/src/settings/SettingsModal.tsx` — `SleepSettingsSection` を1セクションとして差し込むだけ（Codex 指摘6）。

`apps/web/src/dashboard/Dashboard.tsx` / `dashboardQueries.ts` / `ClockCard.tsx` は **変更不要**（条件付きレンダーとアンマウントで停止するため。SettingsModal も Dashboard 内のまま）。

## z-index 整理

既存: Debug 9998/9999、SettingsModal 10000。SleepScreen は最前面の `z-[10001]`（スリープ中は Dashboard 不在なので実際の競合はない）。

## 留意点 / スコープ外

- 祝日の特別扱いはしない（曜日ベース。`@holiday-jp` 連携は対象外）。
- スリープ実行時状態（`awakeUntil` 等）は永続化しない。リロード時はスケジュールから再計算。`SleepSettings` のみ localStorage 永続化。
- `document.visibilityState` とは混同しない（表示中の端末で画面を暗くする機能）。タブ非表示時の `refetchIntervalInBackground` 見直しはスコープ外。
- 起床時間帯の「中」での手動スリープ（`s`）は今回非対応（上記制限）。
- スリープ判定のユニットテストは今回書かない（純粋関数化のみ）。

## 既定値（初期スケジュール）

- `enabled: true`
- `windows: [{ id, days: [1,2,3,4,5], start: "06:00", end: "09:00" }]`（平日朝。設定で調整）
- `manualWakeDurationMin: 15`

## 実装順

フルスクリーンはユーザー操作起点制約・dblclick・復帰直後抑止が絡みスリープ本体より複雑なため、フェーズを分ける（Codex 指摘2、ユーザー了承）。まずスリープ本体を堅く入れる。

フェーズ1: スリープ本体（暗転＋Dashboard アンマウントによる API 停止）
1. `sleepSettingsAtom.ts`（型・既定値・`scheduleAwakeNow`）
2. `isTextInputTarget` 共通化
3. `useSleepController.ts`（now tick・`awakeUntil` 操作ハンドリング・`s` 手動スリープ。フルスクリーンはまだ入れない。ref/StrictMode 対策込み）
4. `SleepScreen.tsx`
5. `App.tsx` 配線（条件付きレンダー）
6. `SleepSettingsSection.tsx` ＋ `SettingsModal.tsx` 配線

フェーズ2: フルスクリーン
7. `useFullscreen.ts`
8. `useSleepController.ts` に `f` キー／空白ダブルクリックのトグルと、復帰直後の `suppressInputUntil` 抑止を追加

## 検証

開発サーバーは起動済み想定（http://asa.localhost:1355）。`agent-browser` で操作・スクショ確認。

1. 初回ロードがスリープ帯（Codex 指摘6）: 起床窓を「現在時刻を含まない」値にして **リロード** → 黒背景＋低輝度時計のみ。Network に天気・発車案内・運行情報の初回リクエストが出ないこと（`@` Debug パネルでも Upstream/Backend が増えない）。
2. 復帰: キー or クリック/タップで即復帰し、Dashboard 表示。復帰直後に取得が走ること。`manualWakeDurationMin` を1分にして、操作をやめて1分後に自動スリープ／操作するとタイマー延長。
3. `s`: スリープ帯で一時起床中に `s` → 即スリープ。
4. 起床帯: 起床窓を「現在時刻を含む」値に → 自動起床し、窓の間は無操作でも寝ない。終了時刻を越えると自動スリープ。
5. 日付またぎ: 窓を `22:00-06:00` 等にして深夜（00:00過ぎ）の起床判定が正しいこと。
6. 設定画面の扱い: スリープ帯で復帰 → 設定を開いて編集している間は寝ないこと（編集操作が延長するため）。開いたまま操作を止めて `manualWakeDurationMin` 経過 → スリープし Dashboard ごと閉じること。編集内容は反映済みであること。
7. 誤フルスクリーン抑止（Codex 指摘4）: スリープ中にダブルクリックして復帰 → 復帰だけでフルスクリーンが発火しないこと。起床中の `f`／空白ダブルクリックでは正しくトグルすること。
8. `pnpm build`（`tsc -b && vite build`）で型エラーが無いこと。
