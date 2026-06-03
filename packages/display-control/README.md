# @asamiru/display-control

Raspberry Pi に接続された物理モニターの状態取得と電源制御を扱う Node 専用パッケージ。

Web、Hono、asamiru のスリープスケジュールには依存しない。`apps/api` は、このパッケージを HTTP/SSE に公開する薄いアダプターとして扱う。

実行時サービスは、DDC/CIによる電源状態取得・待機・復帰と、DRM event・pollingによる状態監視を行う。起動時と状態変化時の診断ログは標準出力・標準エラーへ出力する。

実機確認スクリプト:

```sh
pnpm --filter @asamiru/display-control check -- --display 1
```
