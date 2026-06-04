import type { RailCatalog } from "./types";

// TypeScript 型解決用の宣言ファイル。
// このファイルはビルド時に Vite プラグイン (catalogActivePlugin) によって
// catalog.production.ts または catalog.demo.ts に差し替えられる。
// Vite は .d.ts を値モジュールとして読み込まないため、バンドルに含まれない。
export declare const RAIL_CATALOG: RailCatalog;
