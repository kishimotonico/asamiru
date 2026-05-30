# ADR: モジュール設定の状態管理に Jotai を採用する

**日付**: 2026-05-30  
**ステータス**: 採用

## 背景

現在、天気の緯度経度・乗車駅・表示方向などの設定値はすべて Vite 環境変数（`VITE_*`）でビルド時に固定されている。
これをブラウザの localStorage に保存し、ユーザーが実行時に変更できるようにしたい。

また、このダッシュボードは時計・カレンダー・交通・天気などのモジュールで構成されており、
将来的にはモジュールごとの独立した設定管理、ON/OFF 切り替え、動的ロードを実現したい。

## 決定

状態管理ライブラリとして **Jotai** を採用し、各モジュールの設定を `atomWithStorage` で管理する。

## 検討した選択肢

### Zustand + persist ミドルウェア

- ストアベースのアーキテクチャ。設定を1つのグローバルオブジェクトにまとめる
- スライスで分割はできるが、本質的にすべてのモジュールが同一ストアに参加する形
- モジュールのアンマウント時の購読解除が手動管理になる
- モジュール単位の独立性が低い

### Jotai（採用）

- アトムベース。各モジュールが自分のアトムをモジュール内ファイルに定義し自己完結する
- `atomWithStorage` で個別キーによる localStorage 保存が自然に書ける
- コンポーネントのアンマウントで購読が自動解除される
- React Suspense との親和性が高く、将来の動的ローディングにも対応しやすい

## 設計方針

各モジュールは自分の設定アトムをモジュールディレクトリ内に持つ。

```
src/
  settings/
    weatherSettingsAtom.ts    ← atomWithStorage("weather-settings", { lat, lon, ... })
    trainsSettingsAtom.ts     ← atomWithStorage("trains-settings", { station, directions })
    enabledModulesAtom.ts     ← atomWithStorage("enabled-modules", [...])  ← 将来用骨格
    SettingsModal.tsx         ← 全モジュール設定UIの入口
```

TanStack Query の `queryKey` に設定値を含めることで、設定変更時に自動的に再フェッチが走る。

```typescript
queryKey: ["dashboard", "weather", { lat, lon }]
```

## トレードオフ

- アトムの依存グラフが暗黙的に広がりやすく、大規模化すると追跡が難しくなることがある
- ただし今回の規模（数個の設定値 + 表示カード）では問題にならない
