# @asamiru/display-control

Raspberry Pi に接続された物理モニターの状態取得と電源制御を扱う Node 専用パッケージ。

Web、Hono、asamiru のスリープスケジュールには依存しない。`apps/api` は、このパッケージを HTTP/SSE に公開する薄いアダプターとして扱う。

現在は DDC/CI と DRM event の実機確認スクリプトのみを含む。

```sh
pnpm --filter @asamiru/display-control check -- --display 1
```
