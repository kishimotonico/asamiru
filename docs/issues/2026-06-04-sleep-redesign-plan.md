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

- アンマウント検知は `cancelled` フラグ（必須）で行い、リトライループとタイマーを止める。現状の `fetchDisplayStatus()` は `AbortSignal` を受け取らないため、`AbortController` での中断はできない。`data/display.ts` を無改修に保つ方針なので、unmount 後に `setEnabled` / `setPower` / `subscribe` が走らないことを `cancelled` ガードで保証する（fetch 自体は速く、abort の実益は小さい）。
- 成功後の定常状態は現状どおり。SSE の `onReconnect → reconcile`（最後の観測値との差分検知）はそのまま流用する。
- GET 成功後に SSE 接続だけ失敗した場合は、EventSource の自動再接続に委ねる（GET リトライループへは戻さない）。`enabled` は既に true で確定しており、`reconcile` が再接続時に状態を取り直すため。GET retry ループへ戻すのは「初回 GET がまだ成功していない」間だけに限定する。
- バックオフ定数（初期1s / 上限30s）はサーバー側 udev 監視の `UDEV_BACKOFF_*` と揃える。
- 接続フロー（GET リトライ → 成功で subscribe）はテスト可能にするため、React に依存しない小さな helper（fake timer / fake fetch・subscribe で駆動できる純粋寄りの関数）へ切り出す。フック本体は helper を起動して `cancelled` ガードを渡すだけにする。

### 却下した代替案（SSE 単独化）

GET を廃して EventSource 一本にし、`onerror` 時の `readyState`（CLOSED=無効/CONNECTING=瞬断）で「無効」と「サーバー未起動」を区別する案は採らない。503（無効）でクローズするか再接続するかの挙動がブラウザ実装に依存し脆い。GET プローブで `{enabled:false}` を明示的に終端扱いするほうが堅い。SSE は確立後の定常再接続に専念させる。

### 対象 / リスク

- 対象: `apps/web/src/sleep/useDisplaySync.ts`（`init`→接続 helper の切り出しを含む）＋接続 helper のテスト（新規）。`data/display.ts` は `cancelled` ガード方式のため無改修。
- 範囲外: サーバー再起動時に設定が enabled→disabled へ変わるケース（運用上 config は静的なので扱わない）。
- リスク: 低。意図のステートマシンには触れない。
- テストは必須（後述）。「起動順序で連動が永久に無効化される」は実害ありとして挙げているため、リトライ成立をユニットで担保する。

## Plan D（C・B 内包）: 意図を明示的な mode へ統一

狙い: `manualSleeping` ＋ `awakeUntil` の2軸合成をやめ、「今なぜスリープ/起床しているか」を単一の判別共用体で持つ。仕様書のステートマシン図とコードを1:1にし、C（起床帯中の手動スリープ）と B（表示ゲートの整理）をこの中で解決する。

### 新しい状態

Codex レビュー指摘2を採用し、`forcedSleep` に解除時刻 `releaseAt` を持たせる。これで `scheduleWake` の tick 差分エッジ検出（取りこぼしリスク）を廃止できる。

```ts
export type SleepIntent =
  | { mode: "schedule" }                              // スケジュールに従う（既定）
  | { mode: "tempAwake"; until: number }              // 期限つき一時起床
  | { mode: "forcedSleep"; releaseAt: number | null };// 強制スリープ。releaseAt で自動解除（null は手動解除のみ）

export type SleepIntentState = {
  now: number;          // 境界・期限の再評価に使う現在時刻（tick で更新）
  intent: SleepIntent;
};
```

`manualSleeping`(bool) は `forcedSleep` モードへ、`awakeUntil`(時刻) は `tempAwake.until` へ畳み込まれ、生の bool フラグが消える。`forcedSleep.releaseAt` は「次にスケジュールが起床へ切り替わる時刻」を保持し、解除タイミングを時刻として表現する。

### アクションと遷移（reducer）

旧 `wake` と `extend` は「操作したら一時起床へ入る/延長する」という同一の遷移に統合し、`activity` 1本にする（解除すべきフラグが無くなるため差が消える）。旧 `clearManual`（`scheduleWake`）は `releaseAt` 化により不要となり廃止する。

```ts
export type SleepIntentAction =
  | { type: "tick"; now: number }
  | { type: "activity"; now: number; awakeMs: number }                  // 操作 / 外部ON（旧 wake + extend）
  | { type: "forceSleep"; now: number; releaseAt: number | null }        // s / OFFボタン / 外部OFF（旧 manualSleep）
  | { type: "resync"; now: number; awakeMs: number; releaseAt: number | null }; // 設定変更の反映
```

遷移表（セルは遷移後のモード、`-` は無変化）。

| 現在 \ アクション | tick(失効) | activity | forceSleep |
| --- | --- | --- | --- |
| schedule | - | tempAwake | forcedSleep |
| tempAwake | schedule（now≥until） | tempAwake(until更新) | forcedSleep |
| forcedSleep | schedule（releaseAt≠null かつ now≥releaseAt） | tempAwake | forcedSleep(releaseAt更新) |

reducer の要点。

- `tick`: `now` を更新。`tempAwake` かつ `now >= until` なら `schedule` へ。`forcedSleep` かつ `releaseAt !== null && now >= releaseAt` なら `schedule` へ正規化する。
- `activity`: 常に `tempAwake{until: now + awakeMs}` へ。どのモードからでも同じ。
- `forceSleep`: 常に `forcedSleep{releaseAt}` へ。`releaseAt` は dispatch 側で算出して渡す（下記）。
- `resync`: 設定変更の反映。`tempAwake` なら `until` を取り直し、`forcedSleep` なら `releaseAt` を取り直す（`schedule` は無変化）。詳細は「設定変更の反映」節。

### desiredSleeping（純粋関数）

```ts
function selectDesiredSleeping(s: SleepIntentState, settings: SleepSettings): boolean {
  switch (s.intent.mode) {
    case "forcedSleep":
      return s.intent.releaseAt !== null && s.now >= s.intent.releaseAt
        ? scheduleSleepingNow(new Date(s.now), settings) // 解除時刻を過ぎたらスケジュール評価へ
        : true;
    case "tempAwake":
      return s.now < s.intent.until ? false : scheduleSleepingNow(new Date(s.now), settings);
    case "schedule":
      return scheduleSleepingNow(new Date(s.now), settings);
  }
}
```

`tempAwake` の失効・`forcedSleep` の解除時刻到達は selector でも吸収する（tick が走る前のレンダーでも正しく評価できるよう冗長に持つ。tick はモードの正規化を担当）。`scheduleSleepingNow` / `scheduleAwakeNow` は無改修。

### C: 起床帯中の手動スリープ（外部仕様として明文化）

Codex 指摘1のとおり、当初の C は内部モデルの改善に留まり、外部仕様の非直感さは残っていた。今回は `forcedSleep` の解除条件を「仕様」として明文化する。

> 手動／外部OFF による `forcedSleep` は、次のユーザー操作・外部ON、または「その操作時刻より後に始まる次のスケジュール起床帯の開始」で解除する。有効な起床帯が無い／スケジュール無効のときは、操作・外部ONでのみ解除する。

この定義なら、起床帯のど真ん中で `s` を押したケースも「今いる起床帯では戻らず、次の起床帯で戻る」と時刻ベースで一貫して説明できる。「流入エッジをたまたま tick が拾う」という実装都合ではなく、`forceSleep` の解除条件として仕様化される。

実装は `releaseAt` で表現する。`forceSleep` の dispatch 時に解除時刻を算出して `releaseAt` へ入れる。

```ts
// forceSleep dispatch 時（フック内、settings を参照できる）
const releaseAt = settings.enabled
  ? nextScheduleWakeStartAfter(new Date(now), settings.windows) // 有効窓が無ければ null
  : null;
dispatch({ type: "forceSleep", now, releaseAt });
```

新規の純粋関数を `sleepSettingsAtom.ts` に追加する（`scheduleAwakeNow` と同居）。

```ts
/** now より後に始まる、最も近いスケジュール起床帯の開始時刻（epoch ms）。無ければ null。 */
export function nextScheduleWakeStartAfter(now: Date, windows: SleepWindow[]): number | null;
```

- 今日から最大7日先まで各日・各有効窓の開始時刻（start の HH:MM、日付またぎ窓も開始は start 側）を列挙し、`now` より厳密に後で最小のものを返す。
- 有効な起床帯（`isEffectiveWindow`）が1つも無ければ `null`。
- 既に起床帯の中で `forceSleep` した場合、その窓の開始は過去なので「次の窓開始」が返る。これは現状の流入エッジ挙動と一致する（今の窓では戻らず次の窓で戻る）。

これにより `scheduleWake` action と「前回 tick との差分で流入を検出する effect」を両方廃止でき、既知課題の「15秒 tick 依存・タブ throttling での境界取りこぼし」が解消する。tick が大きく飛んでも、`releaseAt <= now` の判定は selector / 次回 tick の単純比較で成立する。増えるのは `nextScheduleWakeStartAfter` のテストだけ。

### 設定変更の反映（resync）

Codex 指摘3を反映する。設定変更を監視する effect（依存 `[settings]`）で `resync` を dispatch し、現在のモードに応じて取り直す。

- `tempAwake` 中：`until = now + manualWakeDurationMin*60_000` を取り直す。旧実装の「スリープ帯かつ一時起床中のときだけ」というガードはやめ、スケジュールの内外に関わらず `tempAwake` 中なら反映する（明示 mode に合わせ素直にする）。
- `forcedSleep` 中：`releaseAt = nextScheduleWakeStartAfter(now, windows)`（無効・窓なしは `null`）を取り直す。windows 変更で次の起床帯が変わっても追従する。
- `schedule`：無変化。

これは挙動の意図的な変更点（旧：起床帯中の `tempAwake` 相当では duration 変更が反映されないことがあった → 新：常に反映）。テストで固定する。

### B: 表示ゲートの整理（原案から方針変更）

原案は「外部 power を intent に正規化し `effectiveSleeping` を消す」だったが、詰めると破綻するため変更する。

`power === "off"` を無条件に `forceSleep` へ流すと、手動 wake（モニターへ on 要求済みだが物理はまだ off）の隙間で `forceSleep` が再 dispatch され、`tempAwake` を上書きして wake と競合する。つまり「物理 off を intent に変換する」のは能動的な状態遷移になり危険。現状の `effectiveSleeping` の OR は intent を書き換えない受動的な表示ゲートであり、この競合を構造的に避けている。

そこで B は「統合」ではなく「受動ゲートの明示化」に方針変更する。

- `effectiveSleeping` を `showSleepScreen` に改名し、「intent とは独立した受動的な表示ゲート」であることをコメントで明文化する。
- 式は維持: `showSleepScreen = desiredSleeping || (display.enabled && display.power === "off")`。
- 役割を明記: モニターが物理 off の間は intent に関わらず黒画面（on 要求の反映待ち、再接続時 unknown→off の隙間を埋める安全弁）。intent を書き換えないので wake と競合しない。連動無効時は `power` が常に `unknown` でこの項は効かない。

挙動は不変、クラリティのみの変更。gap #1（外部OFF の SSE で `setPower(off)` と `forceSleep` dispatch が同一ハンドラ → React 18 の自動バッチで同一レンダー）と gap #2（reconcile の prev=unknown→off）は、この受動ゲートが引き続き両方カバーする。

### 各フックの変更

- `useSleepIntent.ts`: state / action / reducer / selector を上記へ全面置換。`actions` は `activity` / `forceSleep` を公開（`wake` / `extend` / `manualSleep` を廃止）。`forceSleep` は dispatch 時に `nextScheduleWakeStartAfter` で `releaseAt` を算出する。tick effect は維持。流入エッジ検出 effect（旧 `clearManual`）は廃止。`resyncAwake` effect は `resync`（依存 `[settings]`）へ拡張し、`tempAwake.until` と `forcedSleep.releaseAt` の両方を取り直す。
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
- 手動スリープ → `forcedSleep{releaseAt}`、操作/外部ON または `releaseAt` 到達（=次の起床帯開始）で解除。旧 `manualSleeping`＋`clearManual`（流入エッジ）と通常運用では同じだが、解除時刻を状態に持つため tick 取りこぼしに依存しない（堅牢化）。
- 初期状態 `{now, intent: schedule}` は旧 `{awakeUntil:0, manualSleeping:false}` と同値。

意図的な挙動差分は2点。いずれもテストで固定する。

- 設定変更（`manualWakeDurationMin`）の反映を `tempAwake` 中なら常に行う（旧はスリープ帯限定。Codex 指摘3）。
- `forcedSleep` の解除を流入エッジでなく `releaseAt`（解除時刻）で判定する（tick 取りこぼし耐性。Codex 指摘2）。通常運用では同じタイミングで解除される。

## テスト計画

- `useSleepIntent.test.ts`: 新 state / reducer / selector へ全面書き換え。
  - reducer: tick 失効（`tempAwake`→`schedule`、`forcedSleep` で `releaseAt≤now`→`schedule`）、activity→tempAwake、forceSleep→forcedSleep{releaseAt}、resync（`tempAwake.until` と `forcedSleep.releaseAt` を取り直す・`schedule` は無変化）。
  - selector: schedule（窓内/窓外）、tempAwake（未失効=起床・失効後はスケジュール評価）、forcedSleep（`releaseAt` 未到達=スリープ・到達後はスケジュール評価・`releaseAt=null` は常にスリープ）。
- `sleepSchedule.test.ts`: `nextScheduleWakeStartAfter` のケースを追加（同日先の窓 / 翌日 / 日付またぎ窓の start 側 / 起床帯の中からは次の窓 / 有効窓なし=null / enabled=false 経由で null）。`scheduleAwakeNow` 系は不変。
- Plan A（必須）: 接続フロー helper を fake timer ＋ fake fetch/subscribe で検証する。React フック全体ではなく helper を対象にする（`apps/web` の Vitest は `environment: "node"` で DOM 基盤が無いため）。
  - 初回 fetch 失敗 → 1s/2s… リトライで成功すると `enabled=true` と購読開始になる。
  - `{ enabled:false }` はリトライせず終端する。
  - unmount/cancel 後に fetch が resolve しても state 更新・subscribe が走らない。
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

- A: `apps/web/src/sleep/useDisplaySync.ts`（接続 helper 切り出し含む）＋接続 helper のテスト（新規）。`data/display.ts` は無改修。
- D/C/B: `apps/web/src/sleep/useSleepIntent.ts`（全面）, `useSleepController.ts`, `useGlobalInput.ts`, `sleepSettingsAtom.ts`（`nextScheduleWakeStartAfter` 追加）, `useSleepIntent.test.ts`（全面）, `sleepSchedule.test.ts`（`nextScheduleWakeStartAfter` ケース追加）
- docs: `docs/sleep-display-spec.md`, `ARCHITECTURE.md`

## フェーズまとめ

| フェーズ | 内容 | 破壊度 | 備考 |
| --- | --- | --- | --- |
| 1 | A: 連動初期化のリトライ | 小 | 独立・先行。意図には触れない |
| 2 | D（C・B 内包）: mode 統一＋表示ゲート明示 | 中〜大 | reducer 全面・テスト全面。挙動は等価維持 |
| 3 | docs 更新 | - | 図・式を新モデルへ |

## Codexレビュー追記（2026-06-04）

Claude案の大枠、特に「`power === "off"` を intent へ無条件に正規化しない」「`effectiveSleeping` は `showSleepScreen` として受動ゲートに残す」という方針は妥当。`useSleepController` の現状実装では、モニターOFF中の手動 wake が `requestPower("on")` を明示送信しており、この隙間で物理OFFを `forcedSleep` へ再dispatchすると wake と競合する。B の原案を捨てた判断は正しい。

ただし、実装前に以下は計画へ反映したほうがよい。

### 1. C は「内部改善」だけで、外部仕様の非直感さは残る

Plan D/C は「起床帯のど真ん中で手動スリープすると、操作するまで、または次の起床帯開始まで寝たまま」という挙動を維持している。これは `manualSleeping + awakeUntil` の絡みを `forcedSleep` の単一ルールに置き換える内部改善としては良いが、当初の改善提案 C にあった「起床帯中の手動スリープが直感的でない」という外部仕様の課題は実質解消していない。

今回の目的が「外部仕様を変えてでも分かりやすくする」なら、仕様として次を明文化するのがよい。

> 手動/外部OFFによる `forcedSleep` は、次のユーザー操作/外部ON、または「その操作時刻より後に始まる次のスケジュール起床帯」で解除する。

このルールなら、起床帯中に `s` を押した場合も「今いる起床帯では戻らず、次の起床帯で戻る」と説明できる。現状挙動と近いが、「流入エッジをたまたま待つ」ではなく「forceSleep の解除条件」として仕様化できる。

### 2. `scheduleWake` edge effect はまだ複雑さと取りこぼしリスクを残す

Plan D は mode 化する一方で、`scheduleAwakeNow(now - TICK)` と `scheduleAwakeNow(now)` の false→true 比較を残している。これは現在の既知課題「15秒 tick 依存、タブ throttling 等で境界を取りこぼす可能性」を温存する。

より単純にするなら、`forcedSleep` に解除時刻を持たせる案を検討したい。

```ts
export type SleepIntent =
  | { mode: "schedule" }
  | { mode: "tempAwake"; until: number }
  | { mode: "forcedSleep"; releaseAt: number | null };
```

- `forceSleep(now)` 時に `nextScheduleWakeStartAfter(now, settings.windows)` を計算し、`releaseAt` に保存する。
- `tick` は `tempAwake.until` だけでなく `forcedSleep.releaseAt <= now` も `schedule` へ正規化する。
- 有効な起床帯が無い/スケジュール無効なら `releaseAt=null` とし、操作/外部ONだけで解除する。
- スケジュール設定が変わった場合は `forcedSleep` 中だけ `releaseAt` を再計算する action を追加する。

この案なら `scheduleWake` action と「前回tickとの差分で起床帯流入を検出する effect」を消せる。コード量は `nextScheduleWakeStartAfter` のテスト分だけ増えるが、境界取りこぼしがなくなり、仕様も「いつ解除されるか」が時刻として読める。

`releaseAt` 案を採らない場合でも、少なくとも Plan D の完了条件に「tick が大きく飛んだときの `scheduleWake` 取りこぼしを受け入れる/受け入れない」を明記するべき。

### 3. `resyncAwake` の対象を再確認する

現状の `manualWakeDurationMin` 変更反映は「スリープ帯かつ一時起床中」のときだけ期限を取り直す。Plan D でも effect 構造を維持すると、起床帯中に `activity` で `tempAwake` へ入り、その後ウィンドウ終了前に `manualWakeDurationMin` を変更したケースでは `until` が更新されない。

旧挙動維持なら問題ないが、`tempAwake` を明示modeにするなら「tempAwake中は schedule の内外に関係なく duration 変更を反映する」のほうが仕様としては素直。どちらを採るかを Plan D に明記し、テストケースを追加する。

### 4. Plan A は `fetchDisplayStatus` の abort 可否を詰める

Plan A は「`AbortController` か `cancelled` フラグ」と書いているが、現状の `fetchDisplayStatus()` は `AbortSignal` を受け取らない。`data/display.ts` を無改修にするなら abort はできないため、unmount 後の `setEnabled` / `setPower` / `subscribe` を防ぐ `cancelled` guard が必須になる。

`AbortController` を使うなら、影響ファイルに `apps/web/src/data/display.ts` を追加し、`fetchDisplayStatus({ signal })` のように明示的に変更する。

また、GET 成功後に SSE 接続だけ失敗した場合の扱いも実装方針へ書いておくとよい。現状 API は `GET /api/system/display` が無効時 `{enabled:false}` を 200 で返し、`GET /api/system/display/events` は無効時 503 を返す。Plan A の「GET で無効を終端扱い」はこの API と整合しているが、GET 成功後の EventSource エラーはブラウザの自動再接続に委ねるのか、再度 GET retry ループへ戻すのかを決めておく。

### 5. Plan A のテストを「任意」にしない

「起動順序で連動が永久に無効化される」は実害ありとして挙げているため、Plan A の接続リトライはユニットテスト対象にしたい。`apps/web` の Vitest は `environment: "node"` で React hook の DOM テスト基盤が無いため、hook 全体を無理にテストするより、接続フローを小さな純粋/非React helper に切り出して fake timer と fake fetch/subscribe で検証するのが現実的。

最低限ほしいケース:

- 初回 fetch 失敗後、1s/2s/... の retry で成功すると `enabled=true` と購読開始になる。
- `{ enabled:false }` は retry せず終端する。
- unmount/cancel 後に fetch が resolve しても state 更新・subscribe が走らない。

### 6. 仕様書との矛盾を先に解消する

`docs/sleep-display-spec.md` の改善提案 A は「SSE を主接続に格上げ、GET は補助」と書いているが、この実装計画では「GET probe + SSE 定常購読」に変更している。B/C も原案から方針変更されている。実装後に docs 更新するだけだと、作業中に参照する文書同士が矛盾する。

この issue は計画として十分詳細なので、実装前に `docs/sleep-display-spec.md` の「課題と改善提案」へ「実装計画では A/B/C を次の方針へ修正した」と短く追記するか、この issue を正式な上位計画として参照する注記を入れるのがよい。

### 推奨方針

実装するなら次の順がよい。

1. Plan A は採用。ただし retry helper をテスト可能に切り出し、cancel guard を必須にする。
2. Plan D/B は採用。`showSleepScreen` の受動ゲートは残す。
3. Plan C は「挙動不変」ではなく、`forcedSleep` の解除条件を外部仕様として明文化する。
4. 可能なら `forcedSleep.releaseAt` 案で `scheduleWake` edge effect を廃止する。採らない場合は tick 取りこぼしを明示的な既知制約として残す。

## レビュー反映（2026-06-04, Claude）

Codex の6指摘はすべて妥当と判断し、本計画へ取り込んだ。本文（Plan A / D / C / B・テスト計画・影響ファイル）は反映済み。

- 指摘1（C を外部仕様として明文化）: 採用。「Plan D ＞ C」節に `forcedSleep` の解除条件を仕様文として記載。
- 指摘2（`releaseAt` 案で edge 検出を廃止）: 採用。`SleepIntent.forcedSleep` に `releaseAt` を追加し、`nextScheduleWakeStartAfter` を新設。`scheduleWake` action と流入エッジ effect を廃止し、tick 取りこぼし問題を解消。
- 指摘3（`resync` の対象見直し）: 採用。`tempAwake` 中はスケジュール内外を問わず duration を反映する方針へ変更し、意図的な挙動差分として明記＋テスト固定。
- 指摘4（Plan A の abort/SSE失敗の扱い）: 採用。`cancelled` ガード必須（`data/display.ts` 無改修）、GET 成功後の SSE 失敗は EventSource 自動再接続に委ねる旨を明記。
- 指摘5（Plan A のテスト必須化）: 採用。接続フローを React 非依存の helper へ切り出し、fake timer/fetch で3ケースを必須化。
- 指摘6（仕様書との矛盾）: 採用。`docs/sleep-display-spec.md` の「課題と改善提案」冒頭に、本 issue を上位計画として参照し A/B/C/D の方針が更新されている旨の注記を追加した。

残論点なし。次アクションは Plan A の実装着手。
