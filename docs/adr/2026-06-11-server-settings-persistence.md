# ADR: 設定をサーバー JSON へ永続化する

## Status

Accepted

## Context

天気地点、乗車駅、監視路線、カレンダー URL、スリープスケジュール、テーマは Jotai の `atomWithStorage` を使い、ブラウザの localStorage だけへ保存していた。

Raspberry Pi の kiosk ブラウザでは、ブラウザプロファイルの再作成や破損によって localStorage が失われると、すべての設定を再入力する必要がある。一方、設定値は小さく、個人用の単一クライアントから操作する前提なので、ドメイン別の永続化 API やデータベースは必要ない。

スリープ設定は永続化対象だが、現在のスリープ意図や一時起床状態は揮発状態である。この責務分担は [ADR: アプリのスリープ意図はクライアント、モニター状態はサーバーで管理する](2026-06-03-client-sleep-intent-server-display-state.md) と矛盾しない。

## Decision

API サーバーの `ASAMIRU_DATA_DIR/settings.json` を設定の権威とする。`ASAMIRU_DATA_DIR` の既定値は `./data` とし、書き込みは同一ディレクトリの一時ファイルから rename してアトミックに置き換える。

API はドメインスキーマを持たず、`Record<string, unknown>` の全設定を **GET** `/api/settings` と **PUT** `/api/settings` で読み書きする。ファイル未作成は空オブジェクトとして扱うが、壊れた JSON は起動・取得側へエラーとして伝える。

Web は render 前に全設定を取得する。取得失敗時は localStorage へ黙ってフォールバックせず、エラーを表示する。各 atom の同期 storage は、デフォルト、localStorage、サーバーの順で値をマージし、サーバーを優先する。localStorage は同期キャッシュとして更新し、設定変更は1秒 debounce した全量 PUT でサーバーへ保存する。

スリープスケジュールは永続設定としてサーバーへ保存するが、`SleepIntent`、一時起床、手動スリープなどの実行時意図は引き続きクライアントだけが管理する。

## Consequences

- kiosk のブラウザプロファイルを失っても、サーバーの設定ファイルから復元できる。
- localStorage の同期読み込みを維持するため、atom を async storage にせず Suspense を発生させない。
- サーバーと localStorage が異なる場合はサーバー値が優先され、読み込み時に localStorage キャッシュも更新される。
- 全量 PUT は最後に保存したクライアントが勝つ。複数クライアントによる同時編集は対象外とする。
- `settings.json` には秘密性のある ICS URL が含まれうるため、設定内容をログやデバッグイベントへ記録しない。

## Rejected Alternative

localStorage を権威のままバックアップ用途だけでサーバーへ送る案は採用しない。復元時の優先順位が曖昧になり、ブラウザプロファイル消失への対策として不十分になるため。

Jotai に async storage を渡して atom ごとに API から取得する案も採用しない。起動時の複数リクエストと Suspense 境界が増え、全設定を一度に扱う小規模アプリには複雑すぎるため。
