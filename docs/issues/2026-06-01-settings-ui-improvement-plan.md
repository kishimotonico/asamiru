# 設定画面UI改善計画

## 現状

- Web UI は React + Tailwind CSS で実装している。
- UIコンポーネントライブラリは使用していない。
- 設定画面は `apps/web/src/settings/SettingsModal.tsx` に集約されている。
- モーダルはネイティブ `<dialog>` を直接使用している。
- 入力UIはネイティブ `<input>` / `<select>` / checkbox を Tailwind の className で直接スタイリングしている。
- 設定値は Jotai `atomWithStorage` で localStorage に保存している。
- 路線運行情報の選択肢は `packages/shared/src/index.ts` の `MASTER_TRAIN_LINES` を全件 checkbox として表示している。

## 課題

- 路線運行情報の選択肢が多く、checkbox 群では検索・選択・確認がしづらい。
- `SettingsModal.tsx` にフォーム行、入力、追加・削除ロジック、モーダル構造が混在しており、変更範囲が大きくなりやすい。
- 入力欄の幅が固定気味で、モバイル幅ではフォームの読みやすさが落ちる可能性がある。
- カスタム路線追加は Yahoo Transit URL の形式チェックが UI 側で明示されていない。
- モーダルのキャンセル、Escape、backdrop click などの操作仕様が明文化されていない。

## 方針

- 複雑なインタラクションはライブラリを使う。
  - 検索付き複数選択ドロップダウンは keyboard 操作、focus 管理、ARIA、外側クリック、Escape 閉じなどを正しく実装する必要がある。
  - 依存関係を減らすこと自体は本プロジェクトでは主要な判断軸にしない。
  - 見た目は既存の Tailwind CSS 方針を維持し、unstyled/headless 系ライブラリを採用する。
- 第一候補は `@headlessui/react`。
  - Tailwind と相性がよく、Combobox の multiple selection を使って今回の要件を直接表現しやすい。
  - 現在の peerDependencies は React 19 系を許容している。
- Radix UI は Popover / Checkbox / Dialog などの primitive を組み合わせる選択肢だが、検索付き複数選択 Combobox は自前実装が多く残る。
- `react-aria-components` はアクセシビリティ面で強い候補だが、今回の既存コードには Headless UI の方が導入面が軽い。
- 路線選択は「検索付き複数選択ドロップダウン」に置き換える。
- 保存形式は `TrainsSettings.watchedLines: WatchedLine[]` を維持し、API・ダッシュボード側への影響を最小化する。

## 実装ステップ

### 1. フォーム基盤の分割

- `apps/web/src/settings/components/SettingField.tsx`
  - ラベル、補足、エラー表示、レスポンシブ配置を共通化する。
- `apps/web/src/settings/components/TextInput.tsx`
  - 共通 className を集約する。
- `apps/web/src/settings/components/SelectInput.tsx`
  - 乗車駅などの単一選択に使う。
- `SettingsModal.tsx` から重複した input/select className を削減する。

### 2. 路線複数選択コンポーネント

- `apps/web/src/settings/components/LineMultiSelect.tsx` を追加する。
- `@headlessui/react` の Combobox を使う。
- 表示仕様:
  - 閉じた状態では「選択中の路線名」または「N路線を選択」を表示する。
  - 開いた状態では上部に検索テキストボックスを表示する。
  - 検索対象は路線名。大文字小文字差は実質ないが、単純な `includes` でよい。
  - 一覧は check mark 付き option として表示する。
  - 選択済み路線は先頭に寄せる、または選択済みチップとして上部に出す。
  - 「すべて解除」アクションを用意する。
- アクセシビリティ:
  - Combobox の keyboard 操作、ARIA、focus 管理は Headless UI に委ねる。
  - 追加のボタンやチップには適切な `aria-label` を付与する。
- 状態:
  - 親から `selectedLines` と `onChange` を受け取る controlled component にする。
  - `WatchedLine.yahooUrl` を一意キーとして扱う。

### 3. カスタム路線UIの改善

- カスタム路線をプリセット選択とは別枠の「追加済みリスト」として整理する。
- URL 入力時に `https://transit.yahoo.co.jp/diainfo/{rail}/{range}` 形式を検証する。
- 重複URLはボタン disabled だけでなく、短いエラーメッセージで明示する。
- 追加後は検索付きドロップダウンの選択済みに即反映されるようにする。

### 4. 設定モーダル全体の改善

- セクション間の余白を少し詰め、1画面内で設定全体を把握しやすくする。
- モバイルでは各ラベルと入力を縦積みにする。
- close ボタンは記号文字ではなく、既存方針に合わせてテキストまたは軽量なアイコン表現に整理する。
- backdrop click で閉じるかどうかを実装上明確にする。

### 5. 確認

- `pnpm build`
- `http://asa.localhost:1355` を agent-browser で開く。
- デスクトップ幅で設定モーダルを開き、路線検索・追加・削除・保存状態を確認する。
- モバイル幅で設定モーダルを開き、入力欄がはみ出さないことを確認する。
- リロード後に localStorage の設定が維持されることを確認する。

## 完了条件

- 路線運行情報が大量 checkbox ではなく、検索付き複数選択UIで選べる。
- 既存の `watchedLines` 保存形式を維持し、ダッシュボードの路線運行情報表示が壊れない。
- カスタム路線の追加・削除・重複検知が明確に操作できる。
- 設定画面のフォーム部品が分割され、今後の設定項目追加時に `SettingsModal.tsx` へ実装が集中しない。

## 実装結果

- `@headlessui/react` を追加した。
- 設定モーダルをネイティブ `<dialog>` から Headless UI `Dialog` に変更した。
- 入力、select、button、フォーム行を `apps/web/src/settings/components/FormControls.tsx` に分割した。
- 路線運行情報の大量 checkbox を `LineMultiSelect` に置き換えた。
  - Headless UI `Combobox` の multiple selection を利用。
  - 路線名検索、複数選択、選択済みチップ、既定路線の一括解除に対応。
  - 選択済み option のみチェックマークを読み上げ対象にするよう調整。
- カスタム路線追加に Yahoo!路線情報 URL の形式チェックと重複チェックを追加した。
- デバッグパネルより設定モーダルとドロップダウンが前面に出るよう、モーダル系レイヤーの `z-index` を調整した。

## 確認

- `pnpm build`
- agent-browser で `http://asa.localhost:1355` を確認。
- デスクトップ幅で設定モーダル、路線検索、路線追加・解除、URL形式エラー表示を確認。
- モバイル幅 390px で設定モーダルが横にはみ出さず、縦スクロールで操作できることを確認。
