// #settings-catalog-active はビルド/テスト時に Vite/Vitest の resolve.alias によって
// catalog.production.ts または catalog.demo.ts に解決される（catalog-alias.ts 参照）。
// どちらか1ファイルだけが import され、もう一方はバンドルに含まれない。
export type { RailCatalog, TrainsSettings, WeatherCatalog, WeatherSettings } from "./types";
export { RAIL_CATALOG, WEATHER_CATALOG } from "#settings-catalog-active";
