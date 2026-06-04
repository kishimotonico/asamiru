# 2026-06-04 スリープ再設計の実装計画（A / B / C / D）

[スリープ / ディスプレイ連動 仕様](../sleep-display-spec.md) の「課題と改善提案」のうち、A・B・C・D を実装するための詳細計画。E（サーバー権威化）は対象外。

着手順は A（独立・低リスク）を先に、その後 D を軸に C・B を内包して1まとまりで入れる。C・B はいずれも reducer / コントローラの変更で D と密結合するため分割しない。

## 用語と現状の前提

現状の意図は `manualSleeping`(bool) ＋ `awakeUntil`(時刻) ＋ スケジュール（設定）を毎回合成して `desiredSleeping` を逆算している。表示は `effectiveSleeping = desiredSleeping || (display.enabled && display.power === "off")` で決める。物理連動は `useDisplaySync` がマウント時に GET を1回だけ叩き、成功時のみ SSE を購読する。

詳細は仕様書と各ソース（`apps/web/src/sleep/*`）を参照。

## Plan A: モニター連動の初期化リトライ

狙い: 起動順序（web がサーバーより先）や一時的な GET 失敗で `enabled=false` に張り付き、連動が永久に無効化される問題を解消する。SSE は確立後は EventSource が自動再接続するため、欠けているのは「初回接続のリトライ」だけ。

### 方針

`useDisplaySync` の `init()`（1回きり GET）を、バックオフ付きの接続フローへ置き換える。

```
connectWithRetry():
  backoff = 1s
  loop（unmount まで）:
    try:
      info = fetchDisplayStatus()
      if info.enabled === false:
        log "monitor integration disabled"; return   # 終端（無効は確定）
      setEnabled(true); setPower(info.power); subscribe()   # 成功
      return
    catch:                                            # サーバー未起動・瞬断
      log.warn(...)
      await sleep(backoff); backoff = min(backoff * 2, 30s)
```

- アンマウント検知は `AbortController` か `cancelled` フラグで行い、リトライループとタイマーを止める。
- 成功後の定常状態は現状どおり。SSE の `onReconnect → reconcile`（最後の観測値との差分検知）はそのまま流用する。
- バックオフ定数（初期1s / 上限30s）はサーバー側 udev 監視の `UDEV_BACKOFF_*` と揃える。

### 却下した代替案（SSE 単独化）

GET を廃して EventSource 一本にし、`onerror` 時の `readyState`（CLOSED=無効/CONNECTING=瞬断）で「無効」と「サーバー未起動」を区別する案は採らない。503（無効）でクローズするか再接続するかの挙動がブラウザ実装に依存し脆い。GET プローブで `{enabled:false}` を明示的に終端扱いするほうが堅い。SSE は確立後の定常再接続に専念させる。

### 対象 / リスク

- 対象: `apps/web/src/sleep/useDisplaySync.ts`（`init` まわりのみ）。`data/display.ts` は無改修。
- 範囲外: サーバー再起動時に設定が enabled→disabled へ変わるケース（運用上 config は静的なので扱わない）。
- リスク: 低。意図のステートマシンには触れない。

## Plan D（C・B 内包）: 意図を明示的な mode へ統一

狙い: `manualSleeping` ＋ `awakeUntil` の2軸合成をやめ、「今なぜスリープ/起床しているか」を単一の判別共用体で持つ。仕様書のステートマシン図とコードを1:1にし、C（起床帯中の手動スリープ）と B（表示ゲートの整理）をこの中で解決する。

### 新しい状態

```ts
export type SleepIntent =
  | { mode: "schedule" }                  // スケジュールに従う（既定）
  | { mode: "tempAwake"; until: number }  // 期限つき一時起床
  | { mode: "forcedSleep" };              // 手動 / 外部OFF による強制スリープ

export type SleepIntentState = {
  now: number;          // 境界・期限の再評価に使う現在時刻（tick で更新）
  intent: SleepIntent;
};
```

`manualSleeping`(bool) は `forcedSleep` モードへ、`awakeUntil`(時刻) は `tempAwake.until` へ畳み込まれ、生の bool フラグが消える。

### アクションと遷移（reducer）

旧 `wake` と `extend` は「操作したら一時起床へ入る/延長する」という同一の遷移に統合し、`activity` 1本にする（解除すべきフラグが無くなるため差が消える）。

```ts
export type SleepIntentAction =
  | { type: "tick"; now: number }
  | { type: "activity"; now: number; awakeMs: number }  // 操作 / 外部ON（旧 wake + extend）
  | { type: "forceSleep"; now: number }                 // s / OFFボタン / 外部OFF（旧 manualSleep）
  | { type: "scheduleWake" }                            // 起床帯への流入エッジ（旧 clearManual）
  | { type: "resyncAwake"; now: number; awakeMs: number };
```

遷移表（セルは遷移後のモード、`-` は無変化）。

| 現在 \ アクション | tick(now≥until) | activity | forceSleep | scheduleWake |
| --- | --- | --- | --- | --- |
| schedule | - | tempAwake | forcedSleep | - |
| tempAwake | schedule | tempAwake(until更新) | forcedSleep | - |
| forcedSleep | - | tempAwake | forcedSleep | schedule |

reducer の要点。

- `tick`: `now` を更新。`tempAwake` かつ `now >= until` なら `schedule` へ正規化（失効）。
- `activity`: 常に `tempAwake{until: now + awakeMs}` へ。どのモードからでも同じ。
- `forceSleep`: 常に `forcedSleep` へ。
- `scheduleWake`: `forcedSleep` のときだけ `schedule` へ（それ以外は同一参照を返す）。
- `resyncAwake`: `tempAwake` のときだけ `until` を取り直す（`manualWakeDurationMin` 変更の即時反映）。

### desiredSleeping（純粋関数）

```ts
function selectDesiredSleeping(s: SleepIntentState, settings: SleepSettings): boolean {
  switch (s.intent.mode) {
    case "forcedSleep":
      return true;
    case "tempAwake":
      return s.now < s.intent.until ? false : scheduleSleepingNow(new Date(s.now), settings);
    case "schedule":
      return scheduleSleepingNow(new Date(s.now), settings);
  }
}
```

`tempAwake` の失効は selector でも吸収する（tick が走る前のレンダーでも正しく評価できるよう冗長に持つ）。`scheduleSleepingNow` / `scheduleAwakeNow` は無改修。

### C: 起床帯中の手動スリープ

`forcedSleep` の解除規則を1本化する。`forcedSleep` から抜けるのは次の2つだけ。

- 操作 / 外部ON（`activity`）→ `tempAwake`
- スケジュール起床帯への流入エッジ（`scheduleWake`）→ `schedule`

これにより「起床帯のど真ん中で手動スリープ → 操作するまで、または次の起床帯の開始まで寝たまま」という挙動が、`manualSleeping` と `awakeUntil` の絡みではなく単一ルールで表現される。朝の自動起床（次の起床帯流入で `schedule` へ復帰）は維持される。流入エッジ検出は現状どおり tick 差分（`scheduleAwakeNow(now)` vs `scheduleAwakeNow(now - TICK)`）で行い、エッジ検出自体はなくならない点は正直に明記する（kiosk 常時表示で tick は安定という前提を引き継ぐ）。

ユーザー視点の挙動は現状から実質変えない。C の価値は「2軸フラグの相互作用」を「mode の1ルール」に置き換えるモデルの明確化にある。

### B: 表示ゲートの整理（原案から方針変更）

原案は「外部 power を intent に正規化し `effectiveSleeping` を消す」だったが、詰めると破綻するため変更する。

`power === "off"` を無条件に `forceSleep` へ流すと、手動 wake（モニターへ on 要求済みだが物理はまだ off）の隙間で `forceSleep` が再 dispatch され、`tempAwake` を上書きして wake と競合する。つまり「物理 off を intent に変換する」のは能動的な状態遷移になり危険。現状の `effectiveSleeping` の OR は intent を書き換えない受動的な表示ゲートであり、この競合を構造的に避けている。

そこで B は「統合」ではなく「受動ゲートの明示化」に方針変更する。

- `effectiveSleeping` を `showSleepScreen` に改名し、「intent とは独立した受動的な表示ゲート」であることをコメントで明文化する。
- 式は維持: `showSleepScreen = desiredSleeping || (display.enabled && display.power === "off")`。
- 役割を明記: モニターが物理 off の間は intent に関わらず黒画面（on 要求の反映待ち、再接続時 unknown→off の隙間を埋める安全弁）。intent を書き換えないので wake と競合しない。連動無効時は `power` が常に `unknown` でこの項は効かない。

挙動は不変、クラリティのみの変更。gap #1（外部OFF の SSE で `setPower(off)` と `forceSleep` dispatch が同一ハンドラ → React 18 の自動バッチで同一レンダー）と gap #2（reconcile の prev=unknown→off）は、この受動ゲートが引き続き両方カバーする。

### 各フックの変更

- `useSleepIntent.ts`: state / action / reducer / selector を上記へ全面置換。`actions` は `activity` / `forceSleep` を公開（`wake` / `extend` / `manualSleep` を廃止）。tick・流入エッジ・`resyncAwake` の effect 構造は維持しつつ参照先を `state.intent.mode` に更新。
- `useGlobalInput.ts`: スリープ中の復帰と起床中の操作を、どちらも単一の `onActivity` へ繋ぐ（300ms 抑止・`preventDefault` 等の副作用はフック内に維持）。`onWake` / `onExtend` の2口を `onActivity` に集約。`onManualSleep` / `onToggleFullscreen` は維持。
- `useSleepController.ts`: 配線を更新。
  - `onExternalOn: intent.actions.activity` / `onExternalOff: intent.actions.forceSleep`
  - `onActivity: intent.actions.activity` / `onManualSleep: intent.actions.forceSleep`
  - `const showSleepScreen = intent.desiredSleeping || (display.enabled && display.power === "off")`
  - 返り値 `sleeping: showSleepScreen` / `sleepNow: intent.actions.forceSleep`
  - 自動復帰失敗時の `requestPower("on")` フォールバックは維持。
- `App.tsx` / `SleepScreen.tsx`: 無改修（`sleeping` の意味は不変）。

### 挙動の等価性（確認済みの想定）

- 起床帯で無操作 → `schedule`、`desiredSleeping=false`、窓終了で即スリープ（猶予なし）。旧 `awakeUntil=0` と同値。
- 起床帯で操作 → `tempAwake{until}`、窓終了後も `until` まで猶予。旧 `extend` の `awakeUntil` 猶予と同値。
- スリープ帯で wake → `tempAwake`、失効で `schedule`→スリープ。旧 `wake`→`awakeUntil` 失効と同値。
- 手動スリープ → `forcedSleep`、操作 or 流入エッジで解除。旧 `manualSleeping`＋`clearManual` と同値。
- 初期状態 `{now, intent: schedule}` は旧 `{awakeUntil:0, manualSleeping:false}` と同値。

意図的な挙動差分は無し（C もユーザー視点では不変）。

## テスト計画

- `useSleepIntent.test.ts`: 新 state / reducer / selector へ全面書き換え（既存19件相当を置換）。
  - reducer: tick 失効（tempAwake→schedule）、activity→tempAwake、forceSleep→forcedSleep、scheduleWake（forcedSleep のみ遷移・他は同一参照）、resyncAwake（tempAwake のみ更新）。
  - selector: schedule（窓内/窓外）、tempAwake（未失効=起床・失効後はスケジュール評価）、forcedSleep（常にスリープ）。
- `sleepSchedule.test.ts`: 無改修（純粋関数は不変）。
- Plan A: 接続リトライはタイマーモックが要るためユニットは任意。最低限 agent-browser と手動で検証。
- agent-browser / 手動検証:
  - A: サーバー停止状態で web を開く → サーバー起動 → 自動で連動有効化。
  - C: 起床帯中に `s` → 黒画面維持 → 操作で復帰 / 翌朝の窓で自動復帰。
  - 外部 ON/OFF のマッピング（OFF→forcedSleep、ON→tempAwake）。
  - `f`／空白ダブルクリックのフルスクリーン、300ms 抑止。
- `pnpm test` / `pnpm build` 全 green を完了条件とする。

## ドキュメント更新（実装後）

- `sleep-display-spec.md`: 派生式・ステートマシン図を新モデルに更新（図と mode が1:1に）。「直感的でない点」の該当項を解消済み/言い換えに更新。`effectiveSleeping`→`showSleepScreen` の受動ゲート説明を反映。
- `ARCHITECTURE.md`: スリープ節の式（`effectiveSleeping`／`desiredSleeping`）を更新。

## 影響ファイル一覧

- A: `apps/web/src/sleep/useDisplaySync.ts`
- D/C/B: `apps/web/src/sleep/useSleepIntent.ts`（全面）, `useSleepController.ts`, `useGlobalInput.ts`, `useSleepIntent.test.ts`（全面）
- docs: `docs/sleep-display-spec.md`, `ARCHITECTURE.md`

## フェーズまとめ

| フェーズ | 内容 | 破壊度 | 備考 |
| --- | --- | --- | --- |
| 1 | A: 連動初期化のリトライ | 小 | 独立・先行。意図には触れない |
| 2 | D（C・B 内包）: mode 統一＋表示ゲート明示 | 中〜大 | reducer 全面・テスト全面。挙動は等価維持 |
| 3 | docs 更新 | - | 図・式を新モデルへ |
