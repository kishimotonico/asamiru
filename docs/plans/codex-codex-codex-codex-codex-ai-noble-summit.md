# モニター電源連動（DDC/CI）実装計画

## Context

asamiru のスリープ状態と Raspberry Pi 4 に HDMI 接続したモニターの待機・復帰を連動させる。タッチパネル非搭載・キーボード非常設の kiosk のため、モニターの物理電源ボタン ON が唯一のスケジュール外復帰手段であり、双方向連動（Phase 3）が必須要件となる。

正となる設計ドキュメント:
- `docs/issues/2026-06-03-raspberry-pi-monitor-power-integration.md`
- `docs/adr/2026-06-03-client-sleep-intent-server-display-state.md`（Web=スリープ意図 / Server=モニター状態）
- `docs/adr/2026-06-03-optional-display-control-package.md`（Node専用パッケージ・実行時オプショナル）

実機での「物理ボタン OFF → DDC `setvcp D6 01` で復帰」はユーザーが確認済み。前提成立として進める。Phase 2（一方向）と Phase 3（双方向）を一度に実装する。

責務分割:
- `packages/display-control`（Node専用）: DRM/DDC アクセス、状態取得、コマンド相関、polling、hotplug 監視。
- `apps/api`: 環境変数を読み、display-control を生成し、HTTP/SSE へ変換する薄いアダプター。loopback 制限。
- `apps/web`: スリープ意図の正を維持。SSE を App レベルで購読し、外部 ON/OFF を入力操作として反映。

## 共有型（`packages/shared/src/index.ts` に追記）

Web も使う wire 型は shared に集約する（既存方針どおり。display-control は Node専用なので Web から直接 import しない）。

```ts
export type DisplayConnection = "connected" | "disconnected" | "unknown";
export type DisplayPower = "on" | "off" | "unknown";
export type DesiredDisplayPower = "on" | "standby";
export type DisplayCommandPhase = "idle" | "commanding" | "settling";
export type DisplayPowerOrigin = "external" | "command" | "unknown";
export type DisplayObservationTrigger = "initial" | "poll" | "hotplug" | "command-confirmation";
export type DisplayErrorCode =
  | "ddc_timeout" | "display_not_found" | "unexpected_output" | "ddc_failed" | "not_enabled";
export type DisplayCapabilities = {
  canReadConnection: boolean; canReadPower: boolean; canSetPowerOn: boolean; canSetStandby: boolean;
};
export type DisplayStatus = {
  connector: string;            // id は廃止し connector に一本化
  connection: DisplayConnection;
  power: DisplayPower;
  powerOrigin: DisplayPowerOrigin;
  desiredPower: DesiredDisplayPower | null;
  commandPhase: DisplayCommandPhase;
  capabilities: DisplayCapabilities;
  lastObservedAt: string | null;
  lastCommandAt: string | null;
  error: { code: DisplayErrorCode; message: string; occurredAt: string } | null;
};
export type DisplayEvent = { status: DisplayStatus; trigger: DisplayObservationTrigger };
export type DisplayInfoResponse = { enabled: false } | ({ enabled: true } & DisplayStatus);
```

## packages/display-control を Node 専用パッケージとして完成

現状はスクリプト専用構成で `apps/api` から import できない。`@asamiru/shared` と同じ作法に揃える。

ビルド構成:
- `package.json`: `types`/`exports`（`./dist/index.d.ts` / `./dist/index.js`）、`"build": "tsc -b"`、`"test": "vitest run"` を追加。deps に `@asamiru/shared: workspace:*`、devDeps に `vitest` を追加。
- `tsconfig.json`: `composite: true`、`declaration: true`、`rootDir: "src"`、`outDir: "dist"` を追加し、`include` を `["src"]` に変更（スクリプトの typecheck は別 tsconfig か `check` 実行時の tsx に委ねる）。
- `vitest.config.ts`: node 環境。

新規ソース（`src/`）:
- `displayDriver.ts` — interface `DisplayDriver { readConnection(); readPower(); setStandby(); setPowerOn(); }`。
- `ddcCiDisplayDriver.ts` — `ddcutil getvcp/setvcp D6` を `execFile`（shell不使用・固定引数・timeout）で実行。DRM `/sys/class/drm/<connector>/status` を読む。`D6` パースは `x01→on`/`x04→off`/その他→`unknown`（check スクリプトの正規表現を踏襲、想定外は OFF と推測しない）。
- `fakeDisplayDriver.ts` — in-memory power。`simulateExternal(power)` で物理ボタン操作を模擬。
- `drmConnector.ts` / `udevMonitor.ts` — check スクリプトの sysfs 読取・`udevadm monitor` パースを再利用可能な形に切り出し。udev は終了時に指数バックオフで再起動し、再起動直後に full snapshot を取る。
- `displayService.ts` — オーケストレーター。
  - 状態機械 `idle | commanding | settling`。`setDesiredPower` 送出時に `commanding`→DDC→`settling`（確認期限 **最低6秒**、物理ON復帰途中の約3.5秒の `disconnected`/`Display not found` を跨ぐ）。
  - `settling` 明け以降の遷移のみ `powerOrigin: "external"` と判定。コマンド由来は `"command"`。
  - polling 5秒・**skip-if-busy**（実行中はスキップ）。hotplug は debounce 1秒→再取得、`unknown` 時は1秒間隔で数回リトライ。
  - `power: "off"` は `D6=0x04` を連続2回観測したときだけ確定（単発・`unknown`・`Display not found` を OFF にしない）。
  - 目標状態と観測状態が一致する場合は DDC コマンドを送らない（skip-if-matches）。同一 desired を polling 毎に再送しない。
  - DRM/DDC アクセスを直列化。`subscribe(cb)` で `DisplayEvent` を配信。`getStatus()`/`start()`/`stop()`。
- `createDisplayService.ts` — factory。`{ enabled, driver: "ddc-ci"|"fake", connector, ddcBus }` を受け、`enabled=false` なら driver を生成せず polling/udev も起動しない NullService を返す。`enabled=true` で DDC/CI 不能ならエラー（暗黙無効化しない）。
- `index.ts` — `createDisplayService` と型を re-export。

テスト（vitest, FakeDisplayDriver 使用）:
- `displayService.test.ts`: ①コマンド由来遷移は `powerOrigin="command"` で external を出さない ②`simulateExternal("off")` で external off を配信 ③settling 中の過渡 `disconnected` を external と誤判定しない ④skip-if-matches（既に off で standby 要求→DDC 未送出）⑤OFF は連続2回で確定。
- `createDisplayService.test.ts`: `enabled=false` で driver が一度も呼ばれない（spy）こと、`setDesiredPower` が `not_enabled` を返すこと。

## apps/api アダプター

- `src/displayRoutes.ts`（新規）: `createDisplayRoutes(env)` を提供。
  - env 読取: `ASAMIRU_DISPLAY_ENABLED`(既定 false)、`ASAMIRU_DISPLAY_DRIVER`(`ddc-ci`既定 / `fake`)、`ASAMIRU_DISPLAY_CONNECTOR`、`ASAMIRU_DDC_BUS`。
  - `GET /api/system/display` → 無効時 `{ enabled: false }`、有効時 `{ enabled: true, ...status }`。
  - `PUT /api/system/display/desired-power`（body `{ power: "standby"|"on" }`）→ 有効時のみ `setDesiredPower`。無効時は `not_enabled` エラー。
  - `GET /api/system/display/events` → `streamSSE`（`hono/streaming`）で `service.subscribe` を配信。接続時に初期 snapshot、切断時 unsubscribe、heartbeat コメント。
  - loopback 制限ミドルウェアを `/api/system/display/*` に適用。`getConnInfo`（`@hono/node-server/conninfo`）の remote address が `127.0.0.1`/`::1`/`::ffff:127.0.0.1` 以外なら 403。CORS だけに頼らない。
  - dev 用 fake 制御: `driver=fake` のときだけ `POST /api/system/display/_fake`（loopback限定）→ `service.simulateExternal(power)`。物理ボタンを WSL から模擬。
- `src/index.ts`: 上記ルートを **`app.all("/api/*", 404)`（現 137行）より前**に登録。`serve` 起動時に `service.start()`、SIGINT/SIGTERM で `stop()`。
- `package.json`: deps に `@asamiru/display-control: workspace:*`、`"test": "vitest run"`。`tsconfig.json` references に `../../packages/display-control` を追加。

## apps/web 連動

- `src/data/display.ts`（新規）: `fetchDisplayStatus()`（GET）、`putDesiredPower(power)`（PUT、失敗は握りつぶしてスリープ自体は失敗させない）、`subscribeDisplayEvents({ onStatus, onReconnect })`（`EventSource` ラッパ。`apiEndpoint("/api/system/display/events")`。`onopen` で `onReconnect` を呼び再同期）。
- `src/sleep/useSleepController.ts`（拡張）: スリープ意図の単一所有者にする。
  - `manualSleeping` state を追加。`desiredSleeping = manualSleeping || (scheduleSleepingNow(now) && now >= awakeUntil)`。
  - `effectiveSleeping = desiredSleeping || displayPower === "off"`（`displayPower` は SSE 由来。無効時は `unknown` のままなので既存挙動を維持）。App には `effectiveSleeping` を返す。
  - 既存 `s` キーを `setManualSleeping(true)` に変更（起床帯でも手動スリープ可能に）。キー・pointer の wake は `manualSleeping=false`＋`awakeUntil` 延長。`scheduleAwakeNow` が false→true のエッジで `manualSleeping` を解除（朝の自動復帰、日付またぎ対応）。
  - 起動時に `fetchDisplayStatus`。`enabled` のときだけ購読開始。`desiredSleeping` 遷移時に `putDesiredPower`（ただし観測 power と一致するなら送らない）。
  - SSE `onStatus`: `displayPower` 更新。`powerOrigin==="external"` の `off`→`setManualSleeping(true)`、`on`→wake（`manualSleeping=false`＋延長）。`command`/`command-confirmation` は無視。
  - `onReconnect`/起動時: `GET` で現在状態を取り直し、`external` 差分を適用（SSE切断中の物理操作を自己修復）。
- `src/App.tsx`: `sleeping`→`effectiveSleeping` に差し替え（最小変更）。
- 設定 UI: `src/settings/DisplayStatusSection.tsx`（新規）を `SettingsModal` の「スリープ」付近に追加し、`enabled`・capabilities・現在 power・最終エラーを表示（`enabled:false` なら非表示か無効表示）。

## ビルド/スクリプト配線

- ルート `package.json`:
  - `build`: `pnpm --filter shared build && pnpm --filter @asamiru/display-control build && pnpm --filter api build && pnpm --filter web build`（`typecheck` ではなく `build`）。
  - `dev`: `pnpm --filter shared build && pnpm --filter @asamiru/display-control build && pnpm --filter api --filter web --parallel dev`（shared と同様ビルド前提。dev は tsx 実行だが exports は dist を指すため）。
  - `test`: `pnpm --filter @asamiru/display-control --filter api test`。
- ルート `tsconfig.json` references に `packages/display-control` を追加。
- 必要なら `pnpm install` で workspace 依存を解決。

## 検証

WSL（Fake driver, ハードなし）:
1. `ASAMIRU_DISPLAY_ENABLED=true ASAMIRU_DISPLAY_DRIVER=fake pnpm dev` → http://asa.localhost:1355 を agent-browser で開く。
2. `curl` で `POST /api/system/display/_fake {"power":"off"}` → SleepScreen に遷移、`{"power":"on"}` → 復帰すること。
3. SSE 切断中の自己修復: api を再起動し、停止中に fake を `off`→再接続後に `GET` 再同期で反映されること。
4. スケジュール: 起床 window を直近の数分に設定し、就寝→起床遷移で `putDesiredPower` が standby/on で飛ぶこと（fake のログ/状態で確認）。
5. `ASAMIRU_DISPLAY_ENABLED=false`（既定）で既存スリープ・黒画面・Dashboard アンマウント・API 停止が変わらないこと。

自動テスト:
- `pnpm --filter @asamiru/display-control test` と `pnpm --filter api test`（loopback/disabled）が通ること。
- `pnpm build` が全パッケージ通ること。

実機（Pi, ユーザー実施）:
- `ASAMIRU_DISPLAY_ENABLED=true ASAMIRU_DDC_BUS=<bus> ASAMIRU_DISPLAY_CONNECTOR=HDMI-A-1` で起動。
- 受け入れ基準: 就寝帯で待機 / 起床帯で復帰 / 物理 OFF でアプリスリープ（最大約10秒）/ 物理 ON でアプリ復帰 / 制御失敗でも黒画面と API 停止維持 / 自前コマンドを物理操作と誤認しない / 復帰途中の `disconnected`・`Display not found`・単発 `unknown` で誤スリープしない。

## 補足

- i2c 権限（`i2c_dev` load、サービス実行ユーザーの `i2c` group、udev ルール）は deploy 前提。実装範囲外だが README/issue に従い確認が必要。
- 段階コミット想定: ①shared 型＋display-control パッケージ＋テスト ②apps/api アダプター（Phase 2: PUT/GET）＋loopback ③Phase 3（polling/hotplug/SSE/コマンド相関）＋Web 連動＋設定 UI。
