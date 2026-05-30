# localStorage による設定永続化（完了）

## 目的

現在ビルド時の環境変数で固定されている設定値を、ユーザーがブラウザ上で変更・保存できるようにする。

## スコープ

**今回実装する内容**
- Jotai 導入（`atomWithStorage` によるlocalStorage保存）
- 天気設定: 緯度・経度・地名
- 電車設定: 乗車駅・各本数（デフォルト3）※表示方向は両方固定でUI不要
- 路線運行情報設定: 表示する路線を選択（`watchedTrainLines` をマスターリストとしてフロントでフィルタリング）
- 設定UIモーダル（歯車ボタン → モーダル）
- モジュールON/OFFアトムの骨格（UI実装は将来）

**今回のスコープ外**
- モジュールのON/OFF UI
- ディレクトリ構成の modules/ への大規模再編（将来の別issue）

## 実装ステップ

### 1. Jotai インストール
```
pnpm --filter @asamiru/web add jotai
```

### 2. 設定アトム定義
- `src/settings/weatherSettingsAtom.ts`
  - `lat`, `lon`, `locationName` を `atomWithStorage` で管理
  - デフォルト値は現在の定数を引き継ぐ
- `src/settings/trainsSettingsAtom.ts`
  - `boardingStation`, `directions` を `atomWithStorage` で管理
- `src/settings/enabledModulesAtom.ts`
  - 将来用の骨格のみ

### 3. data 層の修正
- `data/weather.ts`: `import.meta.env` 参照を削除、緯度経度を引数で受け取る
- `data/trains.ts`: `import.meta.env` 参照を削除、設定を引数で受け取る

### 4. dashboardQueries.ts の修正
- `weatherQueryOptions(settings)` → `queryKey` に `{ lat, lon }` を含める
- `trainsQueryOptions(queryClient, settings)` → `queryKey` に `{ boardingStation, directions }` を含める
- Dashboard コンポーネント内でアトムを読んで queryOptions に渡す

### 5. 設定UIの実装
- `src/settings/SettingsModal.tsx`
  - 天気セクション: 緯度・経度・地名の入力
  - 電車セクション: 駅名セレクト、方向ラジオボタン
- `Dashboard.tsx` に歯車ボタンと SettingsModal を追加

## 変更ファイル一覧

| ファイル | 変更種別 |
|----------|----------|
| `apps/web/package.json` | jotai 追加 |
| `src/settings/weatherSettingsAtom.ts` | 新規 |
| `src/settings/trainsSettingsAtom.ts` | 新規 |
| `src/settings/enabledModulesAtom.ts` | 新規（骨格） |
| `src/settings/SettingsModal.tsx` | 新規 |
| `src/data/weather.ts` | 修正（引数化） |
| `src/data/trains.ts` | 修正（引数化） |
| `src/dashboard/dashboardQueries.ts` | 修正（設定値をqueryKeyに含める） |
| `src/dashboard/Dashboard.tsx` | 修正（アトム読み取り + 設定ボタン追加） |

## 完了条件

- 設定モーダルから天気の位置・電車の駅を変更できる
- 変更はlocalStorageに保存され、リロード後も維持される
- 設定変更時にデータが自動的に再フェッチされる
- `.env` ファイルなしでも動作する（デフォルト値を使用）
