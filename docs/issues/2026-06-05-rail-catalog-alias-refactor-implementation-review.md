# 鉄道カタログ alias リファクタ実装レビュー

対象: `worktree-demo-ghpage` `678b891` / `1790860`

## Findings

1. `catalog.smoke.test.ts` が `.gitignore` されており、テスト結果が misleading
   - `apps/web/.gitignore` に `src/settings/catalog/catalog.smoke.test.ts` が追加されている。
   - ローカルには同名の ignored file が存在し、`pnpm --filter web test` では `src/settings/catalog/catalog.smoke.test.ts` が実行されて pass している。
   - しかしこのファイルは Git 管理されていないため、CI や他の開発環境ではこの alias smoke test は実行されない。
   - alias の runtime 解決を守るテストとして価値があるなら commit するべき。不要ならローカルファイルと `.gitignore` 追加を削除し、検証結果に含めないべき。

## Notes

- `catalogActivePlugin` / `active.d.ts` を廃止し、`#rail-catalog-active` alias に寄せた設計は妥当。Vite/Vitest が `catalog-alias.ts` を共有しており、前回レビューの主旨に合っている。
- `sourceUrl: watched.yahooUrl` への変更で、デモ運行情報の React key 重複は解消される。
- `tsconfig.json` の `paths` は production catalog を指しているが、demo catalog も `include: ["src"]` で型チェック対象なので許容範囲。

## Checked

- `pnpm --filter web build`: pass
- `VITE_DEMO_MODE=true VITE_BASE_PATH=/asamiru/ pnpm --filter web build`: pass
- `pnpm --filter web test`: pass。ただし ignored smoke test がローカルに存在するため、CI 相当の結果としては割り引いて見る必要がある。
- 本番 build 後、`きさらぎ高速鉄道|demo:kisaragi|ゲヘナ急行` は `dist/assets` に混入なし。
- デモ build 後、`JR山手線|明大前|笹塚` は `dist/assets` に混入なし。
