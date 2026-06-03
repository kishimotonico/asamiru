# ダッシュボードからの手動モニターOFFボタン

## Context

Raspberry Pi に接続したモニターの DDC/CI 電源連携機能はすでに実装済み。問題は、モニターの物理ボタンで電源OFFすると、物理操作をしない限り復帰できないこと。スケジュール起床（朝6時など）になっても、物理OFF中のモニターは自動で点かない。

そこで、ダッシュボード画面上のボタンでソフト的にOFF（DDC/CI standby）できるようにする。ソフトOFFであれば、既存のスケジュール起床ロジックがそのまま `putDesiredPower("on")` を送って自動ON復帰できる。

調査の結果、必要なバックエンド・スケジュール・自動ON復帰のロジックはすべて既存実装に揃っており、不足しているのは「ダッシュボードのボタンから手動スリープ意図（`manualSleeping`）を立てる経路」だけと判明した。本変更はこの1点を最小の配線追加で実現する。

## 既存実装で満たされている前提（再実装しない）

- API: `apps/web/src/data/display.ts` の `putDesiredPower(power: "on"|"standby")` が `PUT /api/system/display/desired-power` を叩く。standby=OFF, on=ON。
- 自動ON復帰: `apps/web/src/sleep/useSleepController.ts`
  - desired power 送信 Effect（89-99行）が `desiredSleeping` 変化で `putDesiredPower(desiredSleeping ? "standby" : "on")` を自動送信（skip-if-matches あり）。
  - 起床帯入りエッジ（69-76行）で `setManualSleeping(false)` され、上記 Effect が `on` を自動送出する。
  - つまり「`manualSleeping=true` を立てる」だけで、朝の起床帯で自動的に復帰する。
- 手動スリープの既存手段: `s` キー押下で `setManualSleeping(true)`（231-236行）。
- 復帰: SleepScreen 中はキー/ポインタ操作を window capture リスナが拾い `wake`（199-211行）で復帰する。ボタン側に復帰処理は不要。

## 決定事項（ユーザー確認済み）

- ボタン押下時の挙動: 既存 `s` キーと同じ手動スリープに入る（SleepScreen に切り替わり、同時にモニターが standby へ）。
- ボタンの配置・見た目: ClockCard ヘッダの歯車ボタン左隣に、同サイズのアイコンボタンとして置く。

## 採用する設計

手動OFF要求を `useSleepController` の戻り値に操作関数 `sleepNow()` として公開し、`App.tsx` → `Dashboard` → `ClockCard` へ props で渡す（案A）。

理由: 操作系を `useSleepController` 内に集約する既存設計に最も忠実で、`s` キーと同一の内部ロジックを共有できる。`manualSleeping` の単一情報源を崩さない。props は既存の `onSettingsClick` と同じ経路・深さで1本増えるだけ。Jotai atom 化（案B）は実行時 state を atom と useState に二重管理する代償が大きく、window CustomEvent（案C）は型安全性とテスト容易性で劣るため採用しない。

## 変更箇所

### apps/web/src/sleep/useSleepController.ts
- `s` キーハンドラ（231-236行）と同一ロジックの `sleepNow` を `useCallback` で定義する。

  ```ts
  const sleepNow = useCallback(() => {
    setManualSleeping(true);
    setNow(Date.now());
  }, []);
  ```

- 既存 `s` キーハンドラも `sleepNow()` 呼び出しに置き換え、ロジック重複を解消する。
- 戻り値の型を `{ sleeping: boolean; now: number; sleepNow: () => void }` に拡張し（23行・281行付近）、`sleepNow` を返す。

### apps/web/src/App.tsx
- `const { sleeping, now, sleepNow } = useSleepController();`（7行）。
- `<Dashboard onSleepClick={sleepNow} />` として渡す（11行付近）。

### apps/web/src/dashboard/Dashboard.tsx
- `DashboardProps` に `onSleepClick?: () => void` を追加（17-19行）。
- `<ClockCard ... onSleepClick={onSleepClick} />` へ素通しする（30-33行）。

### apps/web/src/dashboard/ClockCard.tsx
- `ClockCardProps` に `onSleepClick?: () => void` を追加（4-8行）。
- 歯車ボタン（33-44行）の左隣、同じ flex 行内に「モニターOFF」アイコンボタンを追加する。歯車と同じ `h-9 w-9` のインラインアイコンボタンスタイルを踏襲し、月または電源アイコンの SVG を入れる。`aria-label="モニターをOFF"`。
- `onSleepClick` が undefined のときは歯車と同じく `onSleepClick ? (...) : null` で非表示にする。

ボタンは ActionButton（`apps/web/src/settings/components/FormControls.tsx:63`）ではなく、ClockCard ヘッダの既存アイコンボタンに視覚的に揃える。

## UI/UX の補足

- displayEnabled=false（連携無効）でも、ボタンは常時表示でよい。`manualSleeping=true` はアプリ内スリープ（SleepScreen 表示）として機能し、`putDesiredPower` は送信 Effect の `if (!displayEnabled) return`（90行）でスキップされるだけで害はない。出し分け/disable は今回は行わない（必要なら別途 `displayEnabled` を戻り値に追加して対応）。
- ボタンクリックは pointerdown capture リスナ（245-255行）を通るが、クリック時点では `effectiveSleeping` は false なので `extend` が走るだけ。その後 `onClick` で `setManualSleeping(true)` され、`desiredSleeping = manualSleeping || (...)`（39行）が OR で優先するためスリープに入る。順序競合はない。

## 検証方法

自動テスト
- `apps/web/src/sleep/` 配下の既存テスト構成を確認し、`useSleepController` のテストがあれば `sleepNow()` で `sleeping` が true になること、起床帯エッジで false に戻ることを追加する。`scheduleSleepingNow`/`scheduleAwakeNow`（`sleepSettingsAtom.ts:45,78`）は純粋関数なので既存テストで担保。

手動確認（agent-browser で http://asa.localhost:1355 を使用）
1. `ASAMIRU_DISPLAY_ENABLED=true`（実機 or fake driver）で起動。
2. モニターOFFボタン押下 → 画面が SleepScreen に切替、`PUT .../desired-power` に `{power:"standby"}` が飛ぶことを Network/サーバログで確認。実機ではモニターが standby に入ること。
3. 黒画面でキー押下/タップ → ダッシュボード復帰、`{power:"on"}` 送信を確認。
4. ボタンOFF状態のまま起床帯時刻（設定 `windows`、例 06:00）を跨ぐ → 自動で `setManualSleeping(false)`・`{power:"on"}` 送信・復帰することを確認（窓内の時刻に一時変更すると即検証可。69-76行はエッジ検出に tick が要る点に注意）。
5. `displayEnabled=false` でボタン押下 → SleepScreen には入るが `putDesiredPower` は送られない（90行で return）ことを確認。
6. `s` キーとボタンが同一挙動であることを確認。

## 主要ファイル

- apps/web/src/sleep/useSleepController.ts（`sleepNow` 追加・戻り値拡張）
- apps/web/src/App.tsx（props 受け渡し）
- apps/web/src/dashboard/Dashboard.tsx（props 素通し）
- apps/web/src/dashboard/ClockCard.tsx（ボタン追加）
