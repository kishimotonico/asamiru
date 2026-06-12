// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/",
      "**/node_modules/",
      "apps/web/public/mockServiceWorker.js",
      "apps/api/src/data/",
      "**/*.tsbuildinfo",
      "claude-design-mock/",
      ".claude/worktrees/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // apps/web: ブラウザ向け React コード
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
    },
  },
  // apps/web: Vitest を使うテストファイル
  {
    files: ["apps/web/**/*.test.{ts,tsx}"],
    languageOptions: {
      globals: globals.vitest,
    },
  },
  // apps/api, packages/*: Node 向けコード
  {
    files: ["apps/api/**/*.ts", "packages/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["apps/api/**/*.test.ts", "packages/**/*.test.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.vitest },
    },
  },
  // ルート・各 app/package の設定ファイル（Vite/Vitest config 等。Node 上で実行される）
  {
    files: ["**/*.config.{js,ts,mjs,cjs}", "**/catalog-alias.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
