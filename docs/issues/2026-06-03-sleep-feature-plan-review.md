# スリープ機能計画レビュー

ClaudeCode のスリープ機能計画本文は、このリポジトリ内では確認できなかった。
そのため、既存実装から見える設計上のレビュー観点と、実装前に取り込むべき提案を記録する。

## 前提

- ダッシュボードは `apps/web/src/dashboard/Dashboard.tsx` に集約されている。
- データ取得は TanStack Query で、天気・発車案内・運行情報の全てが `refetchIntervalInBackground: true` で継続取得される。
- 設定は Jotai `atomWithStorage` と `mergedStorage` で localStorage 永続化されている。
- 時計は `ClockCard` 内で独自に 1 秒 interval を持つ。

## 提案

### 1. スリープを「画面表示」ではなく「アプリ状態」として扱う

単に暗いオーバーレイを出すだけだと、バックグラウンドの API ポーリングは止まらない。
`sleeping` を UI 表示・クエリ有効化・時計更新粒度の共通入力にし、スリープ中は不要な更新を止める設計にした方が、機能名と効果が一致する。

推奨構成:

- `sleepSettingsAtom`: 有効/無効、開始時刻、終了時刻、手動解除の扱いを保持
- `useSleepState(now, settings)`: 現在時刻から `sleeping` と次回切替時刻を計算
- `Dashboard`: `sleeping` を受けて通常画面またはスリープ画面を描画
- `dashboardQueries`: `sleeping` のとき `enabled: false` または `refetchInterval: false`

### 2. 判定ロジックは UI から分離する

睡眠時間帯は日付またぎが本質なので、コンポーネント内に条件式を散らすと壊れやすい。
`22:00-06:00`、`00:00-04:00`、`23:59-00:01`、同一時刻設定などを純粋関数で扱い、テスト可能にするべき。

特にこのアプリは既に深夜帯ロールオーバーを発車案内側で持っているため、時間境界の仕様を曖昧にすると将来の保守で混乱する。

### 3. スリープ中にも最小限の復帰導線を残す

壁掛け表示や常時表示端末を想定するなら、完全な空画面より以下のような状態が実用的。

- 背景は黒または低輝度
- 現在時刻だけ低輝度で表示
- クリック/タップ/キー入力で一時解除
- 一時解除後は一定時間で自動的にスリープへ戻る
- 設定ボタンへの導線は残す

これにより「設定ミスで戻れない」「夜中に画面が明るい」「API は止まったが状態が分からない」を避けられる。

### 4. 手動スリープとスケジュールスリープを分ける

スケジュールによる自動スリープだけだと、昼間に一時的に消したい要求に応えにくい。
一方で手動状態を永続化しすぎると、翌朝も復帰しない事故が起きる。

提案:

- スケジュール: localStorage に永続化
- 手動一時スリープ/解除: セッション状態または期限付き localStorage
- `until` を持たせ、期限切れで自動的にスケジュール判定へ戻す

### 5. クエリ停止時の復帰戦略を決める

スリープ解除直後に古いデータが残るのは自然だが、長時間スリープ後は即時更新したい。
`sleeping: true -> false` の遷移で対象クエリを invalidate/refetch する設計を明示する。

対象:

- 発車案内
- 運行情報
- 天気

復帰時に全て同時 refetch すると API が一瞬集中するため、現状規模では問題ないが、実装箇所は `Dashboard` または専用 hook に集約した方がよい。

### 6. SettingsModal に直接ロジックを詰め込まない

設定 UI は既に肥大化しつつある。
スリープ設定は `sleepSettingsAtom.ts` と `SleepSettingsSection.tsx` に分け、`SettingsModal` はセクションを並べるだけに寄せるのがよい。

### 7. ブラウザの可視状態と混同しない

`document.visibilityState` はタブ非表示の省電力には有効だが、今回のスリープは「表示中の端末で画面を暗くする」機能だと考えるべき。
ただし補助として、タブ非表示時は既存の `refetchIntervalInBackground: true` を見直す価値がある。

## 実装前に決めるべき仕様

- デフォルトでスリープ機能を有効にするか
- 初期時間帯を何時から何時にするか
- 手動解除は何分維持するか
- スリープ中に時計を表示するか、完全暗転にするか
- スリープ中のデータ取得を完全停止するか、低頻度にするか

## 推奨する最初の実装単位

1. `sleepSettingsAtom` と `useSleepState` を追加
2. 日付またぎ判定のテストを追加
3. `Dashboard` にスリープ画面を追加
4. `dashboardQueries` のポーリングを `sleeping` で停止
5. 復帰時の refetch を追加
6. 設定画面にスリープセクションを追加

## 再レビュー: `docs/plans/purring-fluttering-tome.md`

計画は前回レビューの主要点を反映しており、スリープをアプリ状態として扱う方針、復帰時 refetch、設定 UI の分離、日付またぎ判定の純粋関数化はよい。
ただし、実装前に直した方がよい設計上の穴がいくつかある。

### 1. `refetchInterval: false` だけではリクエスト停止にならない

計画では `dashboardQueries.ts` に `sleeping` を渡して `refetchInterval: sleeping ? false : INTERVAL` にするとしている。
これは定期 refetch を止めるだけで、初回マウント時やキャッシュ欠落時の fetch は止めない。

現状の `WeatherDataCard` / `TrainsDataCard` は `useSuspenseQuery` を直接呼ぶため、スリープ中に初回ロードすると、黒画面の裏で天気・発車案内・運行情報の初回 fetch が走る可能性がある。
「スリープ中は新規リクエストは発生しない」という計画の記述とは一致しない。

対策案:

- スリープ中は API を使うカードコンポーネントをマウントしない
- あるいは Suspense query をやめて `enabled: !sleeping` を扱える形へ寄せる
- 復帰時に `invalidateQueries({ queryKey: ["dashboard"] })` して、起床後にまとめて取得する

このアプリでは前者が単純。`App` または `Dashboard` で `sleeping` のときは通常ダッシュボードの async カードを描画しない、または `Dashboard` 全体を描画しない設計にした方がよい。

### 2. override は「無視」ではなく実際に失効させる

計画の `SleepOverride` は `baseAwake` のスナップショットだけで境界越えを検出し、base が変わったら override を無効扱いにする。
しかし read-only derived atom で単に無視するだけだと、古い override が state に残り続ける。

例:

1. 起床窓内で `s` を押し、`{ kind: "sleep", baseAwake: true }` が残る
2. 起床窓終了で `baseAwake=false` になり、override は無視される
3. 次の起床窓開始で `baseAwake=true` に戻る
4. 古い override が再び条件一致し、意図せず手動スリープが復活する

対策案:

- override に `validUntil` を持たせる
- `sleep` override は次のスケジュール境界まで有効
- `wake` override は `min(now + manualWakeDuration, nextScheduleBoundary)` まで有効
- `now >= validUntil` なら必ず無効

このため、今回見送るとしている「次回切替時刻の算出」は実装した方がよい。
ポーリング tick の最適化目的ではなく、override の寿命を正しく表現するために必要。

### 3. 設定モーダル操作中の自動スリープを決める

設定で起床窓を編集している最中に、現在時刻が窓外になった瞬間 `SleepScreen` が `z-[10001]` で設定モーダルを覆う可能性がある。
これは実装上は正しいが、設定作業としてはかなり扱いにくい。

提案:

- SettingsModal が開いている間はスケジュールによる自動スリープを保留する
- または設定変更を即時適用せず、閉じる/保存時に反映する

既存の設定画面は即時反映なので、前者の「設定中は自動スリープしない」がこのコードベースには合う。

### 4. スリープ復帰直後のイベント抑止を明示する

計画では、スリープ中の最初の操作は復帰だけに使い、フルスクリーン等の副作用を起こさないとしている。
ただし pointerdown で復帰した直後に click / dblclick が続くため、実装が甘いと復帰直後にフルスクリーンが発火する。

対策案:

- スリープ復帰時に `suppressInputUntil = performance.now() + 300` のような短い抑止期間を持つ
- その間の click / dblclick / keydown はフルスクリーンや手動スリープ処理に渡さない

`stopPropagation` だけでは window capture listener と React synthetic event の順序差で漏れる可能性があるため、状態として抑止する方が堅い。

### 5. `mousemove` を復帰操作に含めるか再確認する

検証手順では「マウスを動かす」で復帰としている。
リビングの常設モニター用途なら便利だが、ポインタ揺れや接続デバイス由来の微小イベントで意図せず復帰する可能性もある。

方針を明確にする:

- 確実に寝かせたいなら `keydown` / `pointerdown` / `touchstart` のみ
- 触らず復帰しやすくしたいなら `mousemove` も許可。ただし復帰後の手動 wake 延長は throttle する

### 6. 検証に「初回ロードがスリープ時間帯」を追加する

現行の検証は、起床中に設定を変えてスリープへ入る流れが中心。
一番漏れやすいのは、アプリを開いた瞬間がスリープ時間帯のケース。

追加する検証:

- localStorage の設定上、現在時刻が窓外の状態でリロード
- 黒画面だけが出る
- Network に初回の天気・発車案内・運行情報リクエストが出ない
- 操作で復帰した直後だけ取得が走る

## 最終レビュー: 簡素化後のプラン

`docs/plans/purring-fluttering-tome.md` は、override union / baseAwake / 設定モードを廃止し、`awakeUntil` 中心の状態へ寄せられている。
これは前回までの懸念をほぼ解消しており、実装に進める設計になっている。

特に良い点:

- スリープ中は `Dashboard` 自体を条件付きレンダーでアンマウントするため、`useSuspenseQuery` の初回 fetch も定期ポーリングも止まる。
- SettingsModal を特別扱いせず、設定画面の操作も通常のアクティビティ延長として扱うため、モードが増えない。
- 設定画面を開いたまま放置した場合は通常どおりスリープし、Dashboard ごと閉じる仕様になっている。既存設定は即時 localStorage 反映なので、この仕様は整合している。
- override が存在しないため、古い手動状態が次のスケジュールで復活する問題が構造的に消えている。

実装前に明記した方がよい点:

### 1. `awakeUntil` の初期値

初回ロードがスリープ帯のときに即スリープさせるには、`awakeUntil` の初期値は `0` など過去時刻にする。
ここを `Date.now() + manualWakeDuration` にすると、初回ロード直後に15分起きてしまい、検証1と矛盾する。

推奨:

```ts
const [awakeUntil, setAwakeUntil] = useState(0);
```

### 2. フルスクリーンは別フェーズでもよい

フルスクリーンはユーザー操作起点・dblclick・復帰直後の入力抑止が絡み、スリープ本体よりイベント処理が複雑になる。
今回の主目的が「暗転＋API停止」なら、先にスリープだけ実装し、フルスクリーンは次フェーズに分けてもよい。

同時に実装する場合は、`dblclick` listener も `useSleepController` の登録対象として明記する。

### 3. window listener は stale closure を避ける

`sleeping` / `settings` / `awakeUntil` を window capture listener から読むため、実装では `useRef` で最新値を参照するか、effect の依存配列と cleanup を厳密に扱う。
`React.StrictMode` が有効なので、listener と interval の二重登録が残らないことも検証する。

結論として、上記3点を押さえれば実装に進んでよい。
