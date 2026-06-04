// catalog/active はビルド時に Vite alias で
// catalog.production.ts または catalog.demo.ts に解決される。
// どちらか1ファイルだけが import され、もう一方はバンドルに含まれない。
export type { RailCatalog, TrainsSettings } from "./types";
export { RAIL_CATALOG } from "./active";
