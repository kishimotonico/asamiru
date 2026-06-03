# ADR: アプリのスリープ意図はクライアント、モニター状態はサーバーで管理する

## Status

Accepted

## Context

asamiru の既存スリープ機能は Web 側の `useSleepController` と localStorage の `sleepSettingsAtom` で完結している。

Raspberry Pi に接続されたモニターは、サーバー側で DRM hotplug event と DDC/CI `D6` を使って状態取得・待機・復帰できる。モニターの物理 ON/OFF をアプリのスリープへ反映するには、サーバーからクライアントへ状態変化を通知する必要がある。

サーバーへスケジュール、一時起床、手動スリープまで移す案もあるが、既存の localStorage 設定との同期、タイムゾーン管理、入力イベント送信が必要になり、変更範囲が大きい。

## Decision

Web とサーバーで異なる責務の状態を管理する。

- Web はアプリのスリープ意図を管理する。
  - スケジュール
  - `awakeUntil`
  - `manualSleeping`
  - `desiredSleeping`
  - `effectiveSleeping`
- サーバーの `DisplayService` は物理モニターの状態と DDC コマンド相関を管理する。
  - DRM connector status
  - DDC/CI `D6` の観測値
  - desired display power
  - `idle | commanding | settling`
  - 最終コマンド、最終エラー

サーバーはアプリのスリープ状態を計算しない。クライアントはサーバーから通知された外部 ON/OFF を、キー・pointer と同じユーザー入力としてスリープ意図へ反映する。

SSE の通知には状態だけでなく、電源状態の主体と観測のきっかけを含める。

```ts
type DisplayPowerOrigin = "external" | "command" | "unknown";
type DisplayObservationTrigger = "initial" | "poll" | "hotplug" | "command-confirmation";

type DisplayEvent = {
  status: DisplayStatus;
  trigger: DisplayObservationTrigger;
};
```

`DisplayStatus` は現在の `powerOrigin` を持つ。クライアントが `manualSleeping` の変更に使うのは、サーバーが `powerOrigin == "external"` と判定した ON/OFF だけとする。`trigger` は状態同期やデバッグ表示に利用するが、ユーザー操作とはみなさない。

## Consequences

- 既存のスリープ設定と判定ロジックを Web 側に維持できる。
- DDC/DRM のハードウェア依存処理とコマンド相関をサーバー側でテストできる。
- 同じ意味のスリープ状態を Web とサーバーで二重管理しない。
- SSE の主体判定と、初回接続時の同期順序を明示的に設計する必要がある。
- 双方向連動は Raspberry Pi 上の kiosk Chromium 1インスタンスに限定する。

## Rejected Alternative

サーバーをスリープ状態全体の権威にし、スケジュールや入力イベントもサーバーへ移す案は採用しない。今回の機能に対して変更範囲が大きく、既存のクライアント側設定モデルを崩すため。
