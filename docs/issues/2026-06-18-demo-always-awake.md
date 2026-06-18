# デモのデフォルトを全時間起動にする

## 背景

GitHub Pages デモ（`https://kishimotonico.github.io/asamiru/`）を開くと、スリープ画面が表示されることが多かった。
原因は `DEFAULT_SLEEP_SETTINGS` が「平日 06:00–09:00 のみ起床、それ以外はスリープ」で、本番運用（Raspberry Pi 常時稼働）向けの値だったため。
デモではアクセスした時刻に関係なくダッシュボードをすぐ見せたい。

## 方針

既存の catalog alias 方式（`#settings-catalog-active` が `catalog.production.ts` / `catalog.demo.ts` に
ビルド時解決される仕組み。鉄道・天気で採用済み）に、スリープのデフォルトも統一した。
`import.meta.env.VITE_DEMO_MODE` を runtime で直接参照する方法は、過去リファクタで避けている方向のため採らない。

- 本番: `enabled: true`（従来どおり平日 06:00–09:00 起床）
- デモ: `enabled: false`（自動スリープOFF ＝ 全時間起動）。`scheduleSleepingNow` が常に false を返すため、
  時刻によらずダッシュボードが表示される。windows / manualWakeDurationMin は本番と同値を据え置き
  （見学者が手動で ON にしても破綻しないように残す）。

## 変更

- `apps/web/src/settings/catalog/types.ts` — `SleepCatalog` 型を追加（`SleepSettings` を型のみ import）
- `apps/web/src/settings/catalog/catalog.production.ts` — `SLEEP_CATALOG`（`enabled: true`）を追加
- `apps/web/src/settings/catalog/catalog.demo.ts` — `SLEEP_CATALOG`（`enabled: false`）を追加
- `apps/web/src/settings/catalog/index.ts` — `SleepCatalog` / `SLEEP_CATALOG` を re-export
- `apps/web/src/sleep/sleepSettingsAtom.ts` — `DEFAULT_SLEEP_SETTINGS` を `SLEEP_CATALOG.defaults` 由来へ差し替え
  （`SleepSettings` / `SleepWindow` 型・guards・スケジュール関数は変更なし）
- `apps/web/src/settings/catalog/catalog.smoke.test.ts` — 本番=true / デモ=false の切り替えと windows 据え置きを検証

実装は Codex に委譲。型定義そのものは `sleepSettingsAtom.ts` に残し、catalog 側は型のみ import するため
runtime 循環参照は発生しない。

## 敵対的レビュー対応（Codex）

実装後、Codex に敵対的レビューを依頼。妥当な指摘1件を取り込んだ。

- [P2] スリープのストレージキーがビルドモードで未分離だった。trains / weather / calendar は
  `-demo` サフィックスでキーを分けているのに、sleep は `asamiru-sleep-settings` を本番・デモ共用。
  `mergedStorage` は保存値をデフォルトより優先するため、同一オリジンに本番設定（`enabled: true`）が
  残っているとデモのデフォルト（`enabled: false`）に被さり「全時間起動」が保証されない。
  → `SLEEP_SETTINGS_STORAGE_KEY` を `import.meta.env.VITE_DEMO_MODE` で `asamiru-sleep-settings-demo` /
  `asamiru-sleep-settings` に分離（他3設定と同じパターン）。`settingsBackup` はこの定数を参照するため自動追従。
- [P3] smoke test がエイリアスではなく具象 catalog を直 import している点は既存の RAIL/WEATHER テストと
  同じ作りで、CI も `pnpm test` を本番 resolve のみで回す（デモ env は build ステップ専用）。優先度低のため見送り。

## 検証

- `tsc -b`（本番 resolve）: パス
- `pnpm --filter web test`（本番 resolve = CI と同条件）: 131 passed
- `VITE_DEMO_MODE=true vitest run catalog.smoke.test.ts`（デモ resolve）: 4 passed
- `VITE_DEMO_MODE=true VITE_BASE_PATH=/asamiru/ pnpm --filter web build`（CI 相当のデモビルド）: 成功
- `eslint .`: パス

備考: `useSleepController.test.ts` はストレージキー `"asamiru-sleep-settings"` を文字列ハードコードしているため
デモ resolve では seed が効かず失敗するが、CI はこのテストを本番 resolve でしか実行しないため影響なし。
