import { DEMO_STATIONS, DEMO_LINES, DEMO_DEFAULTS } from "../../demo/railDemoData";
import type { RailCatalog } from "./types";

// ─── デモ鉄道カタログ ──────────────────────────────────────────────────────

export const RAIL_CATALOG: RailCatalog = {
  stations: DEMO_STATIONS,
  lines: DEMO_LINES,
  defaults: DEMO_DEFAULTS,
};
