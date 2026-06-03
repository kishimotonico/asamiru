# ADR: モニター制御をオプショナルな Node 専用パッケージに分離する

## Status

Accepted

## Context

モニター制御は Raspberry Pi の DRM、I2C、`ddcutil`、`udevadm` に依存する。一方、asamiru の API には鉄道情報取得など、ハードウェアに依存しない責務もある。

モニターを接続しない開発環境、WSL、別の本番環境でも、既存のダッシュボードとブラウザ内スリープ機能は動作し続ける必要がある。

## Decision

モニター制御を `packages/display-control` の Node 専用パッケージとして管理する。

- `packages/display-control`
  - DRM connector status の取得
  - DDC/CI `D6` の取得・待機・復帰
  - 将来の polling、hotplug 監視、コマンド相関
  - ハードウェアなしで検証する fake driver
  - 実機確認スクリプト
- `apps/api`
  - 環境変数の読み取り
  - パッケージの生成・ライフサイクル管理
  - HTTP/SSE への変換
  - loopback 制限
- `apps/web`
  - モニター機能が有効な場合だけ API を利用
  - 無効な場合は既存のブラウザ内スリープだけを利用

パッケージは Hono、React、Web のスリープ設定に依存しない。

モニター機能は実行時オプショナルとする。

```text
ASAMIRU_DISPLAY_ENABLED=false
```

`ASAMIRU_DISPLAY_ENABLED` は未設定または `false` を既定とする。`true` の場合だけ `packages/display-control` の実行時サービスを生成する。

無効時の挙動:

- `ddcutil`、`udevadm`、DRM sysfs、I2C デバイスへアクセスしない。
- polling や子プロセスを起動しない。
- `GET /api/system/display` は `{ "enabled": false }` を返す。
- `PUT /api/system/display/desired-power` は実行せず、機能無効を示すエラーを返す。
- Web はモニター制御 API、状態購読、双方向連動を行わない。
- 既存の `SleepScreen`、Dashboard アンマウント、API リクエスト停止は通常どおり動作する。

有効時に DDC/CI が利用不能な場合は、暗黙に無効化せず設定エラーとして扱う。

## Consequences

- API のハードウェア依存を薄く保てる。
- 同じ Web/API ビルドを Raspberry Pi とモニターなし環境で利用できる。
- 実行時設定だけでオプトアウトできる。
- 新しい workspace package のビルド、型チェック、テストをルートスクリプトへ組み込む必要がある。
- Web が実行時の有効・無効を確認する API 契約が必要になる。
