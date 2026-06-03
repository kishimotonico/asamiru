# Raspberry Pi 4 のモニター接続・電源連動の検討

## 目的

asamiru のスリープ状態と、Raspberry Pi 4 Model B に HDMI 接続されたモニターの待機・復帰を連動させる。

既存のスリープ機能はブラウザ内の状態であり、スリープ中は黒い `SleepScreen` を表示して `Dashboard` をアンマウントする。これにより外部 API リクエストは止まるが、モニター自体は映像を表示し続ける。

本機能の主目的は、スリープ中にモニターを実際の待機状態へ移行し、消費電力、パネルへの負荷、夜間の光を減らすこと。黒画面表示と API 停止は、モニター制御が失敗した場合にも維持する。

本検討では次を分けて扱う。

- モニターが HDMI に接続されているか
- モニターが表示中、待機中、電源断のどれか
- Raspberry Pi からモニターを待機・復帰させられるか
- モニター側の状態を asamiru のスリープに反映できるか

共有開発環境は WSL2 であり、Raspberry Pi の DRM デバイスと `ddcutil` は直接利用できない。対象モニター固有の対応状況は、Raspberry Pi 実機でユーザーが実行した結果をもとに確認する。

対象構成は Raspberry Pi 上の kiosk Chromium 1インスタンスと、`HDMI-A-1` に接続されたモニター1台。実装対象の電源制御方式は、実機確認済みの DDC/CI のみとする。HDMI-CEC は検証しておらず、実装対象に含めない。

現時点で実装済みなのは `packages/display-control` の実機確認スクリプトと package 境界まで。モニター制御本体、API アダプター、Web 連動、`ASAMIRU_DISPLAY_ENABLED` の読み取りは未実装であり、以下は実装仕様である。

## 実機確認結果

Raspberry Pi 4 と対象モニターで、`ddcutil capabilities --display 1` と `ddcutil getvcp D6 --display 1` の実行に成功した。

```text
Model: RTK
MCCS version: 2.2
Feature: D6 (Power mode)
  Values:
    01: DPM: On,  DPMS: Off
    04: DPM: Off, DPMS: Off
    05: Write only value to turn off display

VCP code 0xd6 (Power mode): DPM: Off, DPMS: Off (sl=0x04)
```

この結果から、対象モニターは DDC/CI に応答し、Power mode `D6` をサポートすると判断できる。実装する電源制御方式は DDC/CI とする。

初回の単発取得では `D6=0x04` が返ったが、その時点の実表示状態が不明だったため、状態読取の信頼性は確定できなかった。後述の物理ボタンによる OFF/ON 確認で確定する。

実装前に次の確認を行う。

```sh
# 表示中の値を機械可読形式で記録
ddcutil getvcp D6 --display 1 --terse

# 待機させる
ddcutil setvcp D6 05 --display 1

# 待機中にも DDC/CI が応答するか確認
ddcutil getvcp D6 --display 1 --terse

# 復帰させる
ddcutil setvcp D6 01 --display 1

# 復帰後の値を確認
ddcutil getvcp D6 --display 1 --terse
```

確認結果の判定:

- `D6=05` で画面が消え、`D6=01` で復帰する: `canSetStandby` と `canSetPowerOn` は true。
- 待機中の `getvcp` が失敗する: 制御は利用可能でも、状態取得失敗を `off` とみなさない。
- 表示中と待機中で値が変わり、実状態と一致する: `canReadPower` は true。
- 表示中でも待機中でも `0x04` のまま: `canReadPower` は false。状態取得による双方向連動は行わない。
- `D6=01` で復帰しない: DDC/CI 単独での連動は採用せず、映像信号再投入または別方式を検討する。

追加確認では、`D6=05` で消灯し、`D6=01` で復帰することを目視確認できた。したがって `canSetStandby` と `canSetPowerOn` は true とする。

```text
初回取得: VCP D6 SNC x04
D6=05 後: VCP D6 SNC x04
D6=01 後: VCP D6 SNC x01
```

物理ボタンによる OFF/ON を実機確認した結果、ON 中は `D6=0x01`、OFF 中は `D6=0x04` を安定して取得できた。したがって、この対象モニターでは `canReadPower` も true とする。

```text
ON:  VCP D6 SNC x01
OFF: VCP D6 SNC x04
ON:  VCP D6 SNC x01
```

モニターが OFF の状態から物理ボタンで ON にした際、DRM の hotplug uevent が発生することも確認できた。

```text
ACTION=change
SUBSYSTEM=drm
HOTPLUG=1
CONNECTOR=35
DEVNAME=/dev/dri/card1
```

約 3.5 秒の間に同じ connector について複数回の event が発生した。したがって、このモニターでは物理 ON をイベント駆動で検知できる可能性が高いが、event 1件を ON/OFF の確定状態として扱ってはいけない。hotplug event は状態再取得のトリガーとして debounce して利用する。

物理ボタンで OFF にした際は DRM/udev event が発生しなかった。したがって、この対象モニターでは物理 ON は hotplug event をトリガーに即時検知できるが、物理 OFF は DDC/CI の状態ポーリングに依存する。

物理 ON の復帰途中では、一時的に connector が `disconnected` となり、`ddcutil` が `Display not found` を返すことも確認できた。その後 connector は `connected`、`D6` は `0x01` に安定する。この過渡状態を OFF やエラーとして確定せず、hotplug event 後は再試行する必要がある。

## 結論

サーバー側での確認・制御は技術的に可能だが、HDMI モニター全般に通用する単一の方法はない。

| 対象 | 方法 | Raspberry Pi 4 での可否 | 信頼できる意味 |
| --- | --- | --- | --- |
| HDMI 接続 | Linux DRM/KMS の connector status | 可能 | HDMI sink が接続され、検出できるか |
| モニター電源状態 | DDC/CI の VCP `D6` | 対象モニターで確認済み | モニターが報告する DPM/DPMS 状態 |
| モニター待機・復帰 | DDC/CI の VCP `D6` | 対象モニターで確認済み | 待機指示、復帰指示 |
| モニターの主電源 | HDMI だけでは不可 | 不可 | コンセントや物理電源スイッチの制御ではない |

`/sys/class/drm/.../status` の `connected` は「画面が点灯している」を意味しない。待機中でも Hot Plug Detect や EDID を維持するモニターは多く、逆に主電源を切ると `disconnected` になる機種もある。接続状態を電源状態として扱ってはいけない。

物理的な主電源 OFF は制御できないため、UI と API の用語は「電源 OFF」ではなく「待機状態にする」「復帰させる」とする。

## 利用できる仕組み

### 1. DRM/KMS connector status

現在の Raspberry Pi OS はディスプレイを KMS で扱う。Raspberry Pi 4 の HDMI0 は通常 `HDMI-A-1`、HDMI1 は `HDMI-A-2` として見える。

Linux DRM は connector を sysfs に公開するため、サーバーから次のように接続状態を読める。

```sh
cat /sys/class/drm/card*-HDMI-A-1/status
```

返り値は通常 `connected`、`disconnected`、`unknown` のいずれか。

これは依存パッケージなしで使え、ケーブル抜去や検出可能な HDMI sink の有無を確認する用途には適している。ただし、待機中か表示中かの判定には使えない。

### 2. DDC/CI

一般的な PC モニターでは、HDMI の DDC/I2C 経由で DDC/CI を利用できる場合がある。`ddcutil` はモニター設定を読み書きする Linux ツールで、Raspberry Pi 4 の HDMI I2C に対応している。

MCCS の VCP feature `D6` は Power mode で、モニターが対応していれば状態取得と待機指示に使える。

```sh
ddcutil detect
ddcutil capabilities --display 1
ddcutil getvcp D6 --display 1
ddcutil setvcp D6 05 --display 1
ddcutil setvcp D6 01 --display 1
```

制約:

- モニター側で DDC/CI を有効にする設定が必要な場合がある。
- VCP `D6` を capabilities に載せない、値を正しく返さない、待機後に DDC 通信へ応答しない機種がある。
- `D6=05` はディスプレイを待機させる write-only 値であり、主電源を切る操作ではない。
- 待機後に DDC 通信できなくなる機種では、状態取得失敗を `off` と推測してはいけない。
- Raspberry Pi OS 側で `i2c_dev`、KMS、デバイス権限の設定が必要になる。

PC モニターを使っている場合は、最初に検証する候補として最も現実的。

### 3. 映像出力の停止

KMS、デスクトップセッション、Wayland compositor などから HDMI 出力を止めると、モニターが「信号なし」と判断して自動待機する場合がある。

これはモニターの電源状態を直接扱う方法ではなく、実行ユーザーの GUI セッションや compositor に依存する。また、出力を無効にした後の入力イベントや画面復帰経路が不安定になりやすい。asamiru の API サーバーから扱う第一候補にはしない。

`vcgencmd display_power` のような firmware 側の旧方式も、KMS を前提とする現在の構成では採用しない。

### 4. 物理ボタン操作の検知

DDC/CI は基本的にホストからの要求にモニターが応答する方式であり、モニターの物理ボタン操作を Raspberry Pi へ通知する標準イベントとしては利用できない。`D6` の変化を検知するには、原則として状態取得をポーリングする必要がある。

libddcutil も DPMS sleep state の監視・通知は信頼性の問題から廃止しており、接続・切断イベントだけを監視対象としている。

対象モニターは VCP feature `02`（New control value）と `52`（Active control）も広告しているが、`02` は power 以外の OSD 操作による設定変更を示す機能であり、電源ボタンの検知には使えない。

モニターの物理電源操作によって HDMI Hot Plug Detect が変化する機種では、Linux DRM/udev の hotplug イベントを即時検知に使える。ただし HDMI ではケーブルから EDID EEPROM へ給電されるため、モニターを OFF にしても connector が `connected` のままになる機種がある。DRM イベントだけを前提にはできない。

実装は次のハイブリッド方式とする。

- DRM/udev hotplug イベントを受けたら短時間 debounce し、connector status と DDC power を再取得する。
- hotplug イベントが発生しない操作を補うため、DDC power を低頻度でポーリングする。
- DDC 通信失敗は `unknown` とし、単独では OFF と判定しない。
- `disconnected` は接続状態として保持するが、対象モニターでは ON の復帰途中にも発生するため、単独では OFF と判定しない。
- 信頼できる `D6=0x04` を複数回連続で観測した場合だけ OFF と判定する。
- `D6=0x01` を観測した場合は ON と判定する。

hotplug event は同じ操作で複数回発生し得るため、最後の event から 1 秒程度待って1回だけ再取得する。対象モニターでは最初の再取得時に `Display not found` となる場合があるため、状態が `unknown` の場合は 1 秒程度の間隔で数回再試行してから通常ポーリングへ戻す。

対象モニターでは物理 OFF で event が発生しないことを確認したため、OFF 検知の応答性を確保するため 5 秒程度で DDC power をポーリングする。物理 ON の hotplug event は、次回ポーリングを待たずに復帰を検知するために利用する。実機で安定しない場合は間隔を延ばす。

DRM event の実機確認:

```sh
udevadm monitor --kernel --udev --subsystem-match=drm --property
```

別シェルで、物理ボタンによる OFF/ON 前後の connector status と DDC power を確認する。

```sh
cat /sys/class/drm/card*-HDMI-A-*/status
ddcutil getvcp D6 --display 1 --terse
```

物理 ON では udev event が発生し、物理 OFF では発生しないことを確認済み。ON は event を debounce して即時再取得し、OFF は DDC polling で検知する。

## 推奨仕様

アプリのスリープ意図と物理モニター状態の責務分離は、`docs/adr/2026-06-03-client-sleep-intent-server-display-state.md` に記録する。

### 基本方針

1. Web をアプリのスリープ意図（スケジュール、入力、一時起床、手動スリープ）の正とする。
2. サーバーの `DisplayService` をモニターの観測状態、DDC コマンド、コマンド相関の正とする。
3. スリープ遷移時に、DDC/CI でモニター待機を依頼する。
4. 起床遷移時に、DDC/CI でモニター復帰を依頼する。
5. モニターの外部 ON/OFF は、サーバーが検出したユーザー入力イベントとして Web へ通知する。
6. 双方向連動は Raspberry Pi 上の kiosk Chromium だけで有効にする。開発機など別ブラウザへ物理モニターの状態を反映しない。
7. `SleepScreen` は残す。モニター制御が失敗しても画面を暗くし、API リクエスト停止を維持する。
8. モニター状態の取得失敗や `unknown` を、勝手に `off` や `on` に読み替えない。

### 状態モデル

モニター状態を単一の boolean にしない。

```ts
type DisplayConnection = "connected" | "disconnected" | "unknown";
type DisplayPower = "on" | "off" | "unknown";
type DesiredDisplayPower = "on" | "standby";
type DisplayCommandPhase = "idle" | "commanding" | "settling";
type DisplayPowerOrigin = "external" | "command" | "unknown";

type DisplayCapabilities = {
  canReadConnection: boolean;
  canReadPower: boolean;
  canSetPowerOn: boolean;
  canSetStandby: boolean;
};

type DisplayStatus = {
  id: string;
  connector: string;
  connection: DisplayConnection;
  power: DisplayPower;
  powerOrigin: DisplayPowerOrigin;
  desiredPower: DesiredDisplayPower | null;
  commandPhase: DisplayCommandPhase;
  capabilities: DisplayCapabilities;
  lastObservedAt: string | null;
  lastCommandAt: string | null;
  error: { code: string; message: string; occurredAt: string } | null;
};
```

`connection` と `power` は独立して扱う。例えば対象モニターでは、物理 OFF 中でも `connection: "connected"` かつ `power: "off"` になる。

DDC/CI `D6` から生成する `DisplayPower` は、実機確認に合わせて次の3値だけとする。

| DDC/CI `D6` | `DisplayPower` |
| --- | --- |
| `0x01` | `on` |
| `0x04` | `off` |
| その他、通信失敗 | `unknown` |

### スリープとの連動

既存のスケジュール・一時起床に、起床時間帯でも有効な手動スリープ状態を加えて `desiredSleeping` を求める。

```text
desiredSleeping =
  manualSleeping ||
  (scheduleSleeping(now) && now >= awakeUntil)

desiredDisplayPower = desiredSleeping ? standby : on
```

モニター状態をアプリへ反映する場合は、明示的に観測できた `power == off` だけを利用する。対象モニターでは復帰途中にも `connection == disconnected` が発生するため、接続状態だけではスリープ判定しない。

```text
displayUnavailable = power == off

effectiveSleeping = desiredSleeping || displayUnavailable
```

ただし、`commandPhase` が `commanding` または `settling` の間は、アプリ自身の DDC コマンドによる観測変化を外部操作として Web へ通知しない。`unknown` とエラーは `displayUnavailable` に含めない。

この仕様により、起床時間帯にユーザーがモニターを手動で待機させた場合は Dashboard を止められ、モニターが再び明示的に `on` と観測された場合は Dashboard を再開できる。スケジュール外にモニターを手動で点灯した場合は、既存の入力操作と同じ一時起床として扱う。

### モニターの手動 ON/OFF をユーザー操作として扱う

モニターの手動操作を双方向連動へ使う場合、単に `desiredSleeping` をモニターへ継続反映してはいけない。起床時間帯に人がモニターを OFF にしても、アプリがすぐ ON を再送してしまうため。

`DisplayService` は `idle | commanding | settling` の明示的な状態を持ち、自身が送った DDC コマンドと、その後に観測した状態遷移を関連付ける。`settling` の確認期限を過ぎた後に観測した外部状態遷移だけを、ユーザーによるモニター操作として Web 側へ通知する。

- 外部 `on -> off`: アプリを手動スリープにする。起床時間帯の中でもスリープを維持する。
- 外部 `off -> on`: アプリがスリープ中なら復帰する。スケジュール外では既存のキー・pointer 操作と同様に `awakeUntil` を延長する。
- アプリが送った `standby` / `on` による遷移: ユーザー操作とは扱わない。
- `unknown`、単発の通信失敗、単発の `off` 観測: ユーザー操作とは扱わない。

既存の `awakeUntil` だけでは「起床時間帯の中で手動スリープを維持する」状態を表現できない。双方向連動を実装する際は、モニターの外部 OFF と既存の `s` キーを共通の `manualSleeping` として扱えるよう、スリープ状態モデルを拡張する。

`manualSleeping` は、モニターの外部 ON、キー・pointer による復帰、または `scheduleAwakeNow(now)` が false から true へ変化したエッジで解除する。これにより、日付またぎ window でも次の起床時間帯を正しく検出できる。

既存の `s` キーも `manualSleeping = true` とする。これにより起床時間帯の中でも手動スリープできるようになる。`s` キーまたはモニター外部 OFF による手動スリープは、次の入力操作、モニター外部 ON、次の起床時間帯開始のいずれかで解除する。

DDC/CI には操作主体を通知する仕組みがないため、アプリのコマンドと人の操作がほぼ同時に起きた場合の判定は完全にはできない。コマンド送信時刻、期待する遷移、短い確認期限を持つことで実用上の誤判定を抑える。

### パッケージ構成

接続確認は DRM/KMS sysfs、電源状態の取得と制御は DDC/CI に固定する。CEC や暗黙の代替方式は実装しない。

ハードウェア依存処理は `packages/display-control` の Node 専用パッケージとして管理する。`apps/api` に直接 DDC/DRM 実装を置かない。

```text
packages/display-control/
  src/
    displayDriver.ts
    ddcCiDisplayDriver.ts
    displayController.ts
  scripts/
    check-display-power.ts

apps/api/
  src/
    displayRoutes.ts
```

- `packages/display-control`: DRM、DDC/CI、将来の polling・hotplug 監視・コマンド相関を担当する。Hono、React、Web のスリープ設定には依存しない。
- `apps/api`: 環境変数を読み、display-control パッケージを生成し、HTTP/SSE に変換する薄いアダプターとする。
- `apps/web`: モニター機能が有効な場合だけ API を利用する。

この判断は `docs/adr/2026-06-03-optional-display-control-package.md` に記録する。

`ddcutil` の対象指定は I2C bus（`--bus`）と display 番号（`--display`）のどちらでも可。display 番号は検出順で決まり、接続状態の変化やモニター追加で変わり得るため、複数モニターや構成変更があるなら `ddcutil detect` で確認した bus を明示するのが安定する。単一モニター固定なら display 番号でも実用上問題ない。

設定例（bus 指定・安定重視）:

```text
ASAMIRU_DISPLAY_ENABLED=true
ASAMIRU_DISPLAY_CONNECTOR=HDMI-A-1
ASAMIRU_DDC_BUS=10
```

設定例（display 番号・従来コマンド相当）:

```text
ASAMIRU_DISPLAY_ENABLED=true
ASAMIRU_DISPLAY_CONNECTOR=HDMI-A-1
ASAMIRU_DISPLAY_NUMBER=1
```

`ASAMIRU_DDC_BUS` を指定すれば bus、なければ `ASAMIRU_DISPLAY_NUMBER`（既定 1）で display 番号を使う。bus を優先する。

環境変数:

| 変数 | 既定 | 説明 |
| --- | --- | --- |
| `ASAMIRU_DISPLAY_ENABLED` | `false` | `true` でモニター制御を有効化 |
| `ASAMIRU_DISPLAY_DRIVER` | `ddc-ci` | `fake` でハードウェアなしの開発・検証用 |
| `ASAMIRU_DDC_BUS` | （未指定） | ddcutil `--bus` 番号。安定重視 |
| `ASAMIRU_DISPLAY_NUMBER` | `1` | ddcutil `--display` 番号（bus 未指定時） |
| `ASAMIRU_DISPLAY_CONNECTOR` | `HDMI-A-1` | DRM connector 名 |

`ASAMIRU_DISPLAY_ENABLED` の既定値は false とし、明示的に有効化された場合だけ `packages/display-control` の実行時サービスを生成する。DDC/CI が利用不能な場合はエラーを表示し、暗黙に無効化しない。

`pnpm start` はルートの `.env.local` を Node の `--env-file-if-exists` で読み込む。これにより、Vite のビルド時設定だけでなく、`ASAMIRU_DISPLAY_*` / `ASAMIRU_DDC_BUS` も本番APIプロセスへ渡る。シェルやsystemdで明示した環境変数は `.env.local` より優先する。

実行時オプトアウトの挙動:

- 未設定または `false`: `ddcutil`、`udevadm`、DRM sysfs、I2C デバイスへアクセスせず、polling や子プロセスも起動しない。
- `true`: DDC/CI の利用可否を検証し、モニター制御を有効化する。起動時の初回観測でモニターが応答しなければ警告ログを出す（bus/display 番号や connector の指定ミスを起動時点で検知できる）。暗黙無効化はしない。
- 無効時も既存のブラウザ内スリープ、黒画面、Dashboard アンマウント、API リクエスト停止は通常どおり動作する。
- 同じ API/Web ビルドを Raspberry Pi とモニターなし環境で利用できる。ビルド時フラグは設けない。

### 実行時診断ログ

`pnpm start` 時に、モニター連動が無効ならその旨を表示する。有効時は、実際に選択された `ddcutil` 対象（`--bus N` または `--display N`）、DRM connector、初回 snapshot の `connection` / `power` / `error` を必ず表示する。

起動後は、次の変化を標準出力・標準エラーへ表示する。

- モニター電源の `on` / `off` / `unknown` 遷移
- DRM connector の接続状態遷移
- desired power の制御要求と失敗
- 観測エラー、コマンドエラーの発生・解消

通常の変化なし polling はログを出さない。ログはアプリ内ファイルへ保存せず、systemd 等のプロセス管理側で保持する。

### 実機確認で判明したSSE購読開始の競合

初回の `GET /api/system/display` が `enabled: true` を返した後、Web が `setDisplayEnabled(true)` を呼び、その直後に更新前の `displayEnabledRef.current` を参照してSSE購読の開始可否を判断していた。このため、React stateの反映タイミングによっては `GET` と desired power の送信は動く一方、`GET /api/system/display/events` が開始されず、サーバーが外部ON/OFFを検知してもクライアントが復帰しない状態になった。

初回GETの戻り値を直接使ってSSE購読を開始するよう修正し、state更新タイミングへの依存をなくした。クライアント側でも初回状態、SSE接続、受信イベント、外部電源操作の反映をブラウザコンソールへ出力する。

### display-control パッケージ責務

- `DisplayDriver` interface に `readConnection()`、`readPower()`、`setStandby()`、`setPowerOn()` を定義する。
- 本番用の `DdcCiDisplayDriver` と、ハードウェアなしで状態遷移を検証する `FakeDisplayDriver` を用意する。
- DRM status と DDC/CI の取得を直列化する。
- 外部コマンドを実行する場合は shell を介さず、固定された引数だけを渡す。
- 各操作に短い timeout を設ける。
- コマンド失敗を `unknown` または `error` として保持し、状態を推測しない。
- `udevadm monitor` が終了した場合は指数バックオフ付きで再起動し、再起動直後に full snapshot を取得する。
- 通常 polling は実行中ならスキップし、hotplug retry と重なって queue が伸び続けないようにする。
- 同じ desired power をポーリングごとに再送しない。スリープ・起床遷移時だけ送る。
- 状態をキャッシュし、API 呼び出しで DDC/I2C を競合させない。

### API アダプター責務

- `ASAMIRU_DISPLAY_ENABLED` と接続先設定を読み、display-control パッケージの生成・停止を行う。
- 電源制御を有効にしたのに DDC/CI が利用不能な場合は、設定画面または Debug Overlay で明示する。
- ハードウェア制御 API は loopback 接続だけを許可し、LAN に無認証で公開しない。

API 案:

```text
GET  /api/system/display                 # 実行時の enabled 状態。Phase 2 から提供
PUT  /api/system/display/desired-power   # 待機・復帰要求。Phase 2 から提供
GET  /api/system/display/events          # 状態変化 SSE。Phase 3 で追加
```

`GET /api/system/display` はモニター機能が無効な場合でも利用でき、次を返す。

```json
{ "enabled": false }
```

`PUT /api/system/display/desired-power` は無効時に DDC コマンドを実行せず、機能無効を示すエラーを返す。Web は `enabled: false` を確認した場合、モニター制御 API と状態購読を行わない。

`PUT /api/system/display/desired-power` の body:

```json
{ "power": "standby" }
```

`events` は Server-Sent Events とし、ブラウザがスリープ中でも App レベルの controller が状態変化を受け取れるようにする。Dashboard 内に購読処理を置くと、スリープ中にモニター復帰を検知できない。

SSE は状態だけでなく、観測のきっかけを通知する。電源状態の主体は `DisplayStatus.powerOrigin` に保持する。

```ts
type DisplayObservationTrigger = "initial" | "poll" | "hotplug" | "command-confirmation";

type DisplayEvent = {
  status: DisplayStatus;
  trigger: DisplayObservationTrigger;
};
```

Web が `manualSleeping` の変更に使うのは `powerOrigin == "external"` の ON/OFF だけとする。polling や hotplug は状態再取得のきっかけであり、それ自体をユーザー操作とはみなさない。

双方向連動の SSE も kiosk Chromium だけが購読できるようにする。

### Web 側責務

- 既存の `useSleepController` はスケジュール、一時起床、入力操作を引き続き扱う。
- `manualSleeping` を追加し、アプリのスリープ意図を Web 側で一元管理する。
- App レベルで display status を購読する。
- App 起動時は最初に display status を取得する。`powerOrigin == "external"` の OFF/ON はユーザー操作として反映し、それ以外は現在の `desiredSleeping` から求めた desired power をサーバーへ同期する。
- `desiredSleeping` の遷移時に desired power をサーバーへ送る。
- 明示的な `displayUnavailable` を `effectiveSleeping` に反映する。
- `desiredSleeping` は false だが `displayUnavailable` によりスリープしている場合、キーまたは pointer 操作を明示的な復帰要求として扱い、`on` をサーバーへ送る。
- 外部 ON/OFF イベントを、キー・pointer と同じユーザー入力としてスリープ意図へ反映する。
- モニター制御失敗はスリープ自体を失敗させない。
- 設定画面に能力、現在状態、最終エラーを表示する。

## 導入フェーズ

### Phase 1: 実機能力確認

対象モニターと Raspberry Pi OS の組み合わせで、DDC/CI の `D6` による待機・復帰操作と状態読取、DRM hotplug event による物理 ON の検知を確認済み。`canReadPower`、`canSetPowerOn`、`canSetStandby` は true とする。

### Phase 2: 一方向連動

asamiru のスリープ・起床遷移から、モニターの待機・復帰を制御する。`packages/display-control` は依頼されたときだけ DDC コマンドを実行する actuator とし、常時 polling、`udevadm monitor`、SSE、コマンド相関はまだ起動しない。

この段階でも、既存の黒画面と Dashboard アンマウントは維持する。

受け入れ基準:

- スケジュール上の就寝帯へ入ると、物理モニターが待機する。
- スケジュール上の起床時間帯へ入ると、物理モニターが復帰する。
- DDC/CI 制御が失敗しても、黒画面表示と API リクエスト停止は維持される。

### Phase 3: 観測状態の反映

明示的に取得できる `D6=0x04` を Dashboard の停止条件に加える。対象モニターでは `disconnected` が復帰途中にも発生するため、接続状態だけではスリープ判定しない。

`packages/display-control` に polling、DRM hotplug 監視、SSE 用イベント、コマンド相関を追加する。モニター側の手動 ON/OFF をユーザー操作として扱う双方向連動、連続観測による debounce、起床時間帯でも有効な手動スリープ状態を実装する。

Phase 3 は Phase 2 の実運用後に必要性を再判断する。着手する場合は、起動時に `GET` で現在状態を取得し、クライアントの desired power と突合せ、必要な場合だけ補正コマンドを送る再同期手順を先に確定する。

受け入れ基準:

- モニターの物理 OFF を最大約10秒で検知し、アプリが手動スリープになる。
- モニターの物理 ON を hotplug event と DDC 再取得で検知し、アプリが復帰する。
- アプリ自身の DDC コマンドによる状態変化を、物理ボタン操作として誤認しない。
- 復帰途中の `disconnected`、`Display not found`、単発の `unknown` で誤ってスリープしない。

## 実機確認手順

### 実機確認用スクリプト

DRM hotplug event と DDC/CI `D6` のポーリング結果を同じ時系列で確認するため、`packages/display-control/scripts/check-display-power.ts` を追加した。

通常の観測モードはモニターへ制御コマンドを送らない。スクリプトを起動したまま、モニターの物理ボタンで OFF/ON してログを確認する。

```sh
pnpm --filter @asamiru/display-control check -- --display 1
```

出力例:

```text
2026-06-03T12:00:00.000Z snapshot reason=initial changed=no drm=card1-HDMI-A-1:connected(id=35) ddc=x01 power=on
2026-06-03T12:00:05.000Z snapshot reason=poll changed=yes drm=card1-HDMI-A-1:connected(id=35) ddc=x04 power=off
2026-06-03T12:00:10.000Z drm-hotplug connector_id=35
2026-06-03T12:00:11.000Z snapshot reason=drm-hotplug changed=yes drm=card1-HDMI-A-1:connected(id=35) ddc=x01 power=on
```

主なオプション:

```sh
# 1回だけ現在状態を取得
pnpm --filter @asamiru/display-control check -- --display 1 --once

# 特定 connector だけ表示
pnpm --filter @asamiru/display-control check -- --display 1 --connector card1-HDMI-A-1

# D6=05 で消灯し、確認後に D6=01 で復帰を試みる制御テスト
pnpm --filter @asamiru/display-control check -- --display 1 --control-test
```

`--control-test` はモニターを実際に消灯するため、SSH など別の操作経路を確保してから実行する。

`--display 1` の番号は検出順で変わり得る。実装時の設定候補を確認する場合は、`ddcutil detect` に表示される I2C bus を使う。

```sh
pnpm --filter @asamiru/display-control check -- --bus 10
```

ログの判定:

- `reason=poll` で `ddc=x01` から `ddc=x04` へ変化する: 物理 OFF をポーリングで検知可能。
- `drm-hotplug` の後に `reason=drm-hotplug` で `ddc=x01` になる: 物理 ON を event で即時検知可能。
- `reason=drm-hotplug` で `Display not found` になった後、`reason=drm-hotplug-retry-*` で `ddc=x01` になる: 復帰途中の過渡状態。正常な結果。
- `error=...` が出る: DDC 通信失敗。OFF とみなしてはいけない。
- 物理操作と `ddc` 値が一致しない: `D6` 状態読取を双方向連動に使わない。

### OS・connector

```sh
uname -a
ls -1 /sys/class/drm/
cat /sys/class/drm/card*-HDMI-A-*/status
```

確認項目:

- 使用中の HDMI connector 名
- モニター表示中、モニター待機中、主電源 OFF、ケーブル抜去時の status
- 主電源 OFF と待機を区別できるか

### DDC/CI

```sh
lsmod | grep i2c_dev
ddcutil detect
ddcutil capabilities --display 1
ddcutil getvcp D6 --display 1
```

確認項目:

- 対象モニターが検出されるか
- capabilities に `D6` が含まれるか
- 表示中と待機中で `getvcp D6` が成功するか
- `D6=05` 後に `D6=01` で復帰できるか

待機操作のテストは、モニターの物理ボタンで復帰できる状態で行う。

### 常駐サービスの権限

Phase 2 の前に、API サービスの実行ユーザーで DDC/CI を利用できることを確認する。

```sh
lsmod | grep i2c_dev
ls -l /dev/i2c-*
id
ddcutil getvcp D6 --bus 10 --terse
```

必要に応じて `i2c_dev` の load、API サービス実行ユーザーの `i2c` group 所属、udev ルールを設定する。手動シェルでは成功しても、常駐サービスの実行ユーザーに権限がなければ本番では動作しない。

## 非対応とするもの

- HDMI だけを使ったモニター主電源の遮断
- `connected` を「モニター電源 ON」とみなすこと
- コマンド失敗を「モニター電源 OFF」とみなすこと
- HDMI-CEC による電源制御
- DDC/CI が利用不能な場合の暗黙的な代替方式
- GUI セッション依存の映像出力停止を第一の制御手段にすること

## 参照資料

- Raspberry Pi Documentation: Displays  
  https://www.raspberrypi.com/documentation/configuration/os.html
- Raspberry Pi Documentation: Raspberry Pi 4 の DRM display 名  
  https://www.raspberrypi.com/documentation/usage/gpio
- Linux Kernel Documentation: DRM/KMS connector abstraction and status  
  https://docs.kernel.org/gpu/drm-kms.html
- ddcutil Documentation: Raspberry Pi  
  https://www.ddcutil.com/raspberry/
- ddcutil Documentation: VCP feature `D6` Power mode  
  https://www.ddcutil.com/vcpinfo_output/
- ddcutil Documentation: libddcutil 2.2.0 display change reporting  
  https://www.ddcutil.com/c_api_220/

## レビューと改善提案 (2026-06-03, Claude)

以下はレビュー原文。採用・不採用の判断は末尾の「レビュー対応方針」に記録する。

### 総評

実機検証に基づく結論（DDC/CI `D6` で待機・復帰・状態読取が可能、物理 ON は hotplug、物理 OFF は polling）は妥当で、「接続状態と電源状態を混同しない」「コマンド失敗を OFF と推測しない」という安全側の原則も正しい。Phase 2（一方向）→ Phase 3（双方向）の段階導入も堅実。

一方で、双方向連動を入れる際に既存アーキテクチャと衝突する論点が残っている。既存のスリープ状態は完全にブラウザ側（`useSleepController` + localStorage の `sleepSettingsAtom`、サーバー状態なし）に閉じている。ここへサーバー側 `DisplayService` の観測を流し込むと「状態の正がどこにあるか」が二重化する。以下、優先度順に指摘する。

### 高優先: アーキテクチャ上の論点

状態の正の所在を一本化する。基本方針1は「asamiru のスリープ状態を正とする」だが、Phase 3 でモニターの外部 OFF を `manualSleeping` に昇格させる時点で、実質的にハードウェアも正になる。現状は sleep ロジックが純粋にクライアント側にあるため、提案どおり `manualSleeping` を Web 側に置くと、サーバー（SSE）→ App → 派生 sleeping → desired-power → サーバー、という閉ループの整合をクライアントが背負う。コマンド相関による誤判定抑止もクライアント側に乗ることになり、テストもブラウザ依存になる。代替案（後述）として、kiosk 1台という性質を活かしてサーバーを sleep 状態の権威にする構成を検討する価値がある。

単一デバイス前提を明文化する。`DisplayService` は Raspberry Pi 1台の物理モニター1枚を見るが、サーバー責務には「複数ブラウザからの同時アクセス」とある。物理モニター由来の `manualSleeping` を全ブラウザへ broadcast すると、開発機など別ブラウザの表示まで巻き込む。本機能は「Pi 上の kiosk Chromium 1インスタンス」専用であることを要件に明記し、双方向連動は kiosk セッションに限定する（あるいは display 連動を購読するのは loopback 接続のみ等）。

oscillation（自己発振）対策をステートマシンとして定義する。`desiredSleeping → standby` を送り、観測 `standby → effectiveSleeping` が立つため、コマンドと観測のタイムスタンプ相関がずれると再送ループや「永久にスリープ」が起きうる。本文 285 行でも「コマンド処理中の状態を別途持つ必要」と触れているが、これは時刻ヒューリスティックではなく明示的な状態として持つべき。提案: provider に `idle | commanding | settling` を持たせ、`commanding`/`settling`（コマンド送出後の確認期限内）の間は polling 由来の遷移を `effectiveSleeping` に反映しない。settling 明け以降の遷移だけを「外部操作」とみなす。これで「アプリのコマンド vs 人の操作」を時刻差ではなく状態で切り分けられる。

### 中優先: 仕様の精緻化

`manualSleeping` のクリア条件を具体アルゴリズムにする。本文 302 行「次の起床時間帯の開始で解除」は、日付またぎ window（`scheduleAwakeNow` の朝側／夜側）があるため曖昧。`useSleepController` の現状は `awakeUntil`（タイムスタンプ）しか持たないので、最小実装としては「`manualSleeping` を boolean で持ち、`scheduleAwakeNow(now)` が false→true に変化したエッジでクリア」が日付またぎにも素直に効く。`s` キー（即スリープ）とモニター外部 OFF を同一の `manualSleeping` に集約する方針自体は良いが、既存の「`s` は延長しない即スリープ」とは意味が異なる（`s` は次の操作で復帰、`manualSleeping` は window 終端まで維持）点を仕様として区別して書く。

`DisplayPower` enum を実機で生成しうる値だけにする。当初の型は `on | standby | suspend | off | unknown` の5値だったが、`ddc-ci`（`D6`）は実機上 `x01→on` / `x04→off` / それ以外→`unknown` の3値しか生成しない（check スクリプトの実装どおり）。来ない値に受け手（Web）が分岐を書かずに済むよう、`DisplayPower = on | off | unknown` に縮約する。（対応済み）

ドキュメント内の `canReadPower` の記述を整理する。36 行で「`D6` 読み取りは実状態と一致しないため `canReadPower` は false として扱い…」と書いた後、73 行で物理ボタン検証により `canReadPower` を true に確定している。結論は正しいが、初期の保留記述が残っていて将来の読者が混乱する。36 行の段落は「初回の単発取得では確定できなかった」という経緯に縮め、確定判断は73行に一本化する。

### 実装・運用

`DisplayDriver` 抽象を切ってテスト可能にする。check スクリプトは exec を内包しているが、本番 `DisplayService` は `readConnection() / readPower() / setStandby() / setPowerOn()` を持つ driver interface を定義し、`DdcCiDriver` と、ハードウェア無しでロジックを検証する `FakeDriver` を用意する。oscillation 抑止やステートマシンはこの層で純粋にユニットテストできる（WSL/CI でも回せる）。AGENTS の「過度なフォールバック禁止」に沿い、provider が `none` 以外で driver が利用不能なら例外を上げて設定画面に出す（暗黙の `none` 降格はしない）。

`udevadm monitor` の常駐監視を supervise する。長寿命の子プロセスが死んだ場合、check スクリプトは exit を log するだけ。本番では指数バックオフ付きで再起動し、再起動直後は一度フル snapshot を取り直す（イベント取りこぼし対策）。

OS セットアップの runbook を Phase 2 の前提として残す。`i2c_dev` の load、`/dev/i2c-*` の権限（ddcutil 用 i2c group / udev ルール）、API プロセスを i2c group に所属させる、の手順が deploy 時に必要。Phase 1 は能力確認済みだが、サービス常駐としての権限設計が未記載。

ハードウェア制御 API を loopback に固定する。現状 `apps/api` は `@hono/node-server` で `PORT`(既定 8787) を listen し、CORS は `asa.localhost:1355` 等を許可。kiosk の Chromium が localhost で叩く前提なら、`/api/system/display/*`（特に `PUT desired-power`）は非 loopback リクエストを拒否する middleware を入れるか、別 bind に分離する。本文 362 行の方針を具体化したもの。

`ASAMIRU_DISPLAY_ENABLED` のマスタスイッチを足す。既定 OFF（provider=`none`）にしておけば、WSL の共有開発環境やテストで `ddcutil`/`udevadm` を起動しに行かない。env で明示的に有効化された時だけ driver を生成する。これは「フォールバック」ではなく設定ゲートなので方針に反しない。

polling の競合回避。check スクリプトは poll(setInterval) と hotplug を共有 Promise queue で直列化しているが、5s poll に対し ddcutil timeout 3s + hotplug retry 3×1s が重なると遅延が積む。本番 `DisplayService` は「実行中なら poll をスキップ（skip-if-busy）」にして、queue を無限に伸ばさない。

### 代替案: サーバーを sleep 状態の権威にする

双方向連動まで行くなら、現状のクライアント主導を反転させ、Pi の `DisplayService` が `schedule + manualSleeping + 観測 monitor power` から `effectiveSleeping` を計算し、ブラウザは「サーバーが配る effectiveSleeping を描画 + ユーザー入力イベント（key/pointer）をサーバーへ送る」だけにする案。

利点: 状態の正が1か所、oscillation/コマンド相関のロジックがサーバー側に集約されてユニットテストしやすい、単一デバイス前提と自然に整合する。
欠点: 既存 `useSleepController` のスケジュール判定をサーバーへ移す中規模リファクタが必要、サーバー時刻とタイムゾーン管理が要る。

トレードオフがあるため、Phase 2 は現状設計（クライアント主導の一方向）のまま進め、Phase 3 に入る前にこの反転を採用するか意思決定するのが現実的。少なくとも Phase 3 着手時の分岐点として ADR に残すべき。

### 成功指標と価値の明確化

本機能の主目的は「黒画面表示」ではなく「モニターを実際に待機させること」（消費電力削減・パネル焼き付き防止・夜間の光害低減）である点を冒頭に明記すると、`SleepScreen` を残しつつモニター制御を足す意義がぶれない。受け入れ基準として「スケジュール起床帯の開始で物理モニターが自動復帰する」「就寝帯で物理モニターが待機する」「制御失敗時も黒画面と API 停止は維持される」の3つを Phase ごとに検証項目化することを提案する。

## レビュー対応方針

Claude のレビューを確認し、以下を本文へ反映した。

- kiosk Chromium 1インスタンスと物理モニター1台を対象要件として明記
- `idle | commanding | settling` による DDC コマンド相関
- `scheduleAwakeNow(now)` の false → true エッジによる `manualSleeping` 解除
- DDC/CI 実機結果に合わせた `DisplayPower = on | off | unknown`
- `DisplayDriver` と `FakeDisplayDriver` によるテスト可能性
- `udevadm monitor` の再起動、polling の skip-if-busy、常駐サービス権限、loopback 制限
- `ASAMIRU_DISPLAY_ENABLED` の既定 OFF
- Phase 2・3 の受け入れ基準

サーバーをスリープ状態全体の権威にする案は採用しない。Web はアプリのスリープ意図、サーバーは物理モニター状態と DDC コマンド相関を管理し、同じ状態を二重管理しない。この判断は `docs/adr/2026-06-03-client-sleep-intent-server-display-state.md` に記録した。

`CecDriver` を含む CEC 対応案も採用しない。対象モニターで実機確認できているのは DDC/CI のみであり、今回の実装対象は DDC/CI に固定する。

## 再レビュー (2026-06-03, Claude · 第2回)

改訂版（責務分割 ADR、`idle/commanding/settling`、`DisplayPower = on/off/unknown`、`ASAMIRU_DISPLAY_ENABLED`、Phase ごとの受け入れ基準）を確認した。指摘はおおむね反映されており、設計の質は上がっている。第2回では「Web とサーバーの二重管理は大変では」という論点に絞って再評価する。

### 結論を先に

二重管理の難しさは、実はクライアント／サーバーのどちらが状態を持つかではなく、Phase 3（双方向連動）を入れるかどうかにほぼ全部由来する。そして Phase 3 が増やす複雑さに対して、得られるユーザー価値は小さい。

- Phase 2（一方向）は共有状態がほぼ要らず、本機能の主目的（就寝帯にモニターを実際に待機させ消費電力・光を減らす、起床帯に自動復帰する）を完全に満たす。まずこれを単独で出すのを強く推奨する。
- Phase 3 が足すのは「モニターの物理電源ボタン操作をアプリへ反映する」ことだけ。タッチ kiosk では画面タッチ（pointer）、キー操作（`s`）で同じことができるため、物理ボタン経路の限界価値は低い。費用対効果から Phase 3 は保留、または後述のとおり片方向だけに縮小するのが良い。

### 二重管理についての回答

ADR の責務分割（Web=スリープ意図 / Server=モニター状態と DDC コマンド相関）自体は妥当で、「同じ状態の二重管理ではない」という整理も正しい。コマンド由来か人由来かの判定は、コマンドを送った主体＝サーバーが持つのが自然で、full server-authority より既存の localStorage モデルを壊さない分、このコードベースには合っている。判断自体は支持する。

ただしコストはゼロではない。Phase 3 を入れると本質的に次の2点が残る。

1. `desiredPower` がクライアント（`desiredSleeping` からの派生）とサーバー（`DisplayStatus.desiredPower`）の両方に存在する。サーバー再起動・Chromium リロード・SSE 切断のたびに再同期順序が必要になる（ADR の Consequences でも「初回接続時の同期順序を明示的に設計する必要」と認めている）。kiosk は 24/7 稼働で Chromium が落ちて再読込しうるため、これは実運用で必ず踏む。
2. `effectiveSleeping` はクライアント計算だが、入力にサーバー観測の `power == off` を含む。つまり「寝ているか」の権威がネットワーク越しに分割される。最大約10秒の polling 遅延の間、クライアントの `desiredSleeping` と実モニター状態がずれた表示になりうる。その見せ方を別途設計する必要がある。

これらはすべて Phase 3 を入れて初めて発生する。Phase 2 だけならサーバーはほぼステートレスな actuator（PUT を受けて DDC を叩き成否を返すだけ）で済み、SSE も `powerOrigin` も `commandPhase` も polling も `udevadm monitor` も不要。二重管理の問題はそもそも生まれない。

### Phase 2 を最小構成にする具体案

- API は `PUT /api/system/display/desired-power` の1本で開始する。`GET /api/system/display`（設定画面の現在状態表示用）は任意。SSE は Phase 3 まで不要。
- サーバーはクライアントの意図エッジ（`desiredSleeping` の遷移）を受けたときだけ DDC を叩く。常時 polling は不要。
- 失敗時は error を返すが、黒画面と API リクエスト停止は維持する（既存原則どおり）。

これで主目的を満たしつつ、状態の正はクライアント1か所に保てる。サーバーは「依頼されたら待機・復帰させる」だけの純粋な出力装置になる。

### Phase 3 を入れる場合の最小化

- 外部 OFF を観測しても、クライアントは `desired-power` を再送しない。モニターは既に off なので no-op であり、コマンド相関を濁らせるだけ。`desiredPower` の送出は「人由来でない意図エッジ」だけに限定する。
- 物理ボタンの利用が薄いなら、Phase 3 をさらに割り、「物理 OFF → 手動スリープ」の片方向だけ先に入れ、「物理 ON → 復帰」は hotplug の安定を実運用で確認してから足す。物理 ON は朝の自動復帰（Phase 2 の schedule 起床）と機能が重なるため、後回しでも体験上の損失が小さい。
- 採用する場合は、再同期プロトコル（起動時に `GET` → クライアントの `desiredPower` と突合せ → 必要時だけ補正コマンド）を ADR の Consequences から本文の手順へ具体化する。

### CEC の削除（対応済み）

本文の実装対象から CEC は除外済み。第1回レビュー原文に残っていた `CecDriver` と `DisplayPower` の5値（`standby`/`suspend` の CEC 予約）への言及も削除した。今回の実装対象は DRM/KMS（接続確認）と DDC/CI（電源）に固定する。

### 推奨

1. Phase 2 を上記のステートレス actuator 構成で実装・リリースする（二重管理なし、主目的を充足）。
2. Phase 3 は「本当に物理ボタン操作を反映したいか」をリリース後に判断し、要るなら片方向（OFF→手動スリープ）から段階導入する。
3. 現行 ADR の責務分割は Phase 3 を実装する場合の設計として維持してよい。ただし再同期順序を本文へ落とすことを着手条件にする。

## 第2回レビュー対応方針

Claude の第2回レビューを確認し、以下を採用した。

- Phase 2 は DDC コマンドを依頼時だけ実行する最小の actuator とし、polling、`udevadm monitor`、SSE、コマンド相関を持たない。
- Phase 3 は Phase 2 の実運用後に必要性を再判断する。
- Phase 3 着手前に、起動時の再同期手順を確定する。

加えて、モニター制御は `apps/api` の内部実装ではなく、Node 専用の `packages/display-control` として分離する。API は実行時設定と HTTP/SSE への変換だけを担当する。

モニター機能は `ASAMIRU_DISPLAY_ENABLED` による実行時オプショナル機能とする。未設定または `false` を既定とし、無効時は DDC/DRM へ一切アクセスせず、既存のブラウザ内スリープだけを利用する。この判断は `docs/adr/2026-06-03-optional-display-control-package.md` に記録した。

## 最終レビュー (2026-06-03, Claude · 第3回 / 実装着手前)

`packages/display-control` への分離、`ASAMIRU_DISPLAY_ENABLED` の実行時オプトアウト、API/Web/パッケージの責務分割は明確で、設計として実装に進める水準にある。ただし、運用要件が「タッチパネル非搭載で、モニターの物理電源ボタンを復帰トリガーにする」と確定したことで、前提が一つ覆る。以下、着手前に必ず潰すべき順に挙げる。

### 要件変更の反映: Phase 3 は保留対象ではなく必須

第2回レビューと本文（Phase 3 の「必要性を再判断」、第2回レビュー対応方針）は「物理ボタンはタッチ・キーで代替できるので Phase 3 は後回しでよい」を前提にしていた。タッチパネルが無く、キーボードも常設しない kiosk では、これは成り立たない。物理 ON → 復帰の双方向連動が唯一のスケジュール外復帰手段になる。

- 本文 445 行「Phase 3 は Phase 2 の実運用後に必要性を再判断する」、第2回レビュー対応方針の同趣旨の記述は、要件に合わせて「Phase 3 はこの構成で必須」に改める。
- 「物理 ON → 復帰を後回しにできる」とした第2回の縮小案は撤回する。後回しにできるのは「物理 OFF → 手動スリープ」の方（消灯はスケジュールでも起きるため）。優先実装すべきは「物理 ON → 復帰」。

### 着手前に実機検証すべき最重要の未確認事項

実機ログ（71〜85 行）で検証済みなのは次の2つだけ。

- DDC で待機させ（`D6=05`）→ DDC で復帰（`D6=01`）→ 点灯する。
- 物理ボタンの OFF/ON 中に `D6` の値を読める（`x04` / `x01`）。

検証されていないのは「物理ボタンで OFF にしたモニターを、DDC `setvcp D6 01` で点灯できるか」。DDC 起点の standby からの復帰と、ユーザーが本体ボタンで切った状態からの復帰は、モニターのファームウェア次第で挙動が異なり、後者を DDC で受け付けない機種は珍しくない。

これが NG だと、朝のスケジュール自動復帰（夜に本体ボタンで消した翌朝）も、就寝帯に本体ボタンで消した後の復帰も、DDC では戻せず、タッチもキーも無いため操作不能で詰む。Phase 2 着手前に次を実機で確認する。

```sh
# 物理ボタンで OFF にした状態から
ddcutil getvcp D6 --bus 10 --terse      # x04 を確認（DDC が応答するか）
ddcutil setvcp D6 01 --bus 10           # DDC で復帰を試みる
ddcutil getvcp D6 --bus 10 --terse      # x01 になり、画面が点灯するか目視
```

- 点灯する: 設計どおり進めてよい。
- DDC が応答しない／点灯しない: 「本体ボタン OFF からの復帰」は DDC では不可。この場合、本体ボタン OFF を復帰経路に使う前提自体を見直す（例: 本体ボタンは使わず、消灯はアプリ起点に限定し、復帰は schedule とリモート操作に寄せる、等）。要件と設計の再検討が必要になるため、最優先で確認する。

### Phase 3 のための信頼性設計（タッチレス復帰の安全網）

物理 ON 復帰が唯一の手動復帰手段になるため、その経路の堅牢性が可用性に直結する。SSE のライブイベント1本に依存しない。

- 復帰検知は hotplug だけでなく polling も常時併用する。hotplug や SSE イベントを取りこぼしても、次の DDC polling（約5秒）で `power == on` を観測して復帰できる二重の安全網になる。Phase 3 で polling を止めない理由として明記する。
- SSE は EventSource の自動再接続に加え、再接続のたびにクライアントが `GET /api/system/display` で現在状態を取り直し、`powerOrigin == "external"` の差分を適用する。「SSE 切断中に物理 ON が起きた」ケースを自己修復できる。本文 413 行の「起動時に取得」を「起動時と SSE 再接続時の両方」に広げる。
- `commandPhase = settling` の確認期限を具体値で定義する。物理 ON 復帰途中に約3.5秒 connector が `disconnected` → `Display not found` になる実測があるため、アプリ自身の `D6=01` コマンドの確認期限は最低でも6秒程度を確保する。短すぎると、コマンド由来の復帰途中状態を「外部 ON」と誤判定しうる。
- 遷移時のコマンド送出でも、目標値が現在の観測値と一致する場合は送らない。例: 起床帯に本体ボタンで OFF にして `manualSleeping=true` になった瞬間、`desiredSleeping` は false→true に遷移するが、モニターは既に off なので `standby` を送らない。本文 360 行「polling で再送しない」に「遷移時も観測値と一致するコマンドは送らない」を加える。

### パッケージのビルド構成（実装初手で必ず詰まる）

現状の `packages/display-control` は実機確認スクリプト専用の構成で、`apps/api` から `import` できる状態になっていない。`@asamiru/shared` と揃える。

- `package.json` に `types` と `exports`（`./dist/index.d.ts` / `./dist/index.js`）、`build: "tsc -b"` を追加する。現状は `typecheck` と `check` のみ。
- `tsconfig.json` に `composite: true`、`declaration: true`、`rootDir: "src"`、`outDir: "dist"` を追加し、`include` に `"src"` を加える（現状 `"scripts"` のみ）。
- ルート `tsconfig.json` の `references` に `{ "path": "packages/display-control" }` を追加。`apps/api/tsconfig.json` の `references` にも同パッケージを追加する。
- ルート `package.json` の `build` は現状 `@asamiru/display-control` を `typecheck` するだけ。api が dist を参照するなら、api build の前に当該パッケージを `build` する必要がある（`pnpm --filter shared build && pnpm --filter @asamiru/display-control build && pnpm --filter api build ...`）。`dev` 時は api が tsx なので未ビルドでも解決できるよう exports と `moduleResolution` を NodeNext のまま整合させる。
- `apps/api/package.json` の `dependencies` に `"@asamiru/display-control": "workspace:*"` を追加する。

このパッケージは Node 専用のため、`apps/web` から型を共有する必要が出た場合（`DisplayStatus` / `DisplayEvent` など Web も使う型）は、ハードウェア依存コードと型定義を分け、型は `@asamiru/shared` に置く方が依存が綺麗になる。SSE のイベント型を Web が import する設計なので、ここは着手時に決める。

### loopback 制限の具体化

`/api/system/display/*` を loopback 限定にする方針はあるが、実装手段が未定。`@hono/node-server` は接続情報を取得できるため、`PUT desired-power` と `GET events` に remote address が loopback 以外なら拒否する middleware を入れる。現状 CORS は `asa.localhost:1355` を許可しているが、CORS はブラウザ前提の防御で、直接の HTTP リクエストは止められない点に注意（CORS だけに頼らない）。

### その他（軽微）

- `error.code` の値域を enum で固定する（例: `ddc_timeout` / `display_not_found` / `unexpected_output` / `not_enabled`）。Web の表示分岐と相関ログで使うため、文字列を自由記述にしない。
- `DisplayStatus.id` と `connector` の使い分けが曖昧。単一モニター前提なら `id` は不要か、`connector`（`HDMI-A-1`）に一本化してよい。
- check スクリプトの `D6` パースは `SNC`（simple non-continuous）前提の正規表現。実装側の `DdcCiDisplayDriver` でも同様に、想定外フォーマットは `unknown` に倒す方針を踏襲する（OFF と推測しない原則どおり）。

### 着手可否

ビルド構成の整備（必須）と、上記「物理ボタン OFF → DDC 復帰」の実機確認（最重要）の2点をクリアすれば、Phase 2 から実装に入ってよい。とくに後者は、NG だと設計前提が変わるため、コードを書く前に確認することを強く推奨する。
