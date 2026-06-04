# 鉄道カタログ alias リファクタプランレビュー

対象: `~/.config/claude/plans/ok-serialized-wozniak.md`

## Findings

1. alias を Vite config だけに置くと Vitest runtime の解決が追従しない
   - プランは `apps/web/vite.config.ts` に `resolve.alias` を追加し、`apps/web/tsconfig.json` に `paths` を追加する。
   - これは build と typecheck には十分だが、`apps/web/vitest.config.ts` は Vite config を merge しておらず、将来 `settings/catalog` や `trainsSettingsAtom` を import するテストを追加すると `rail-catalog-active` を runtime 解決できない可能性が高い。
   - 今のテスト対象には該当 import がないため即時 failure ではないが、保守性改善が目的のリファクタなので、alias 定義を共通関数化して Vite/Vitest 両方から使うか、Vitest config にも同じ alias を入れる方がよい。

2. alias token は internal であることが分かる名前の方が安全
   - `rail-catalog-active` でも機能するが、見た目は npm package 名に近い。
   - 将来の依存追加や読解時の混乱を避けるなら `#rail-catalog-active` や `@app/rail-catalog-active` のような internal alias の方が意図が明確。
   - Vite alias と TS `paths` は `#rail-catalog-active` でも扱える。

## Notes

- custom `resolveId` plugin + `active.d.ts` から標準 `resolve.alias` + bare specifier へ寄せる方向は妥当。特殊な importer 判定が消えるので、現行実装より読みやすくなる。
- `sourceUrl: watched.yahooUrl` は key 重複の最小修正として成立する。ただしより意味論を重視するなら、`TrainsCard` 側の React key を `sourceUrl` 単体に依存しない複合 key にする案もある。
- `paths` が production catalog を指しても、demo catalog 自体は `include: ["src"]` により型チェック対象になるため大きな問題はない。demo alias の export 破損は demo build で検出する。

## Verdict

実装に進んでよい。上記 1 は将来のテスト追加時に効くため、今回のリファクタに含めるのが望ましい。
