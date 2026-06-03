// ─── 鉄道情報 ──────────────────────────────────────────────────────

export type TrainStatusLevel = "ok" | "warn" | "info";

export type WatchedLine = {
  name: string;
  yahooUrl: string;
};

export type TrainLineStatus = {
  name: string;
  status: string;
  level: TrainStatusLevel;
  note?: string;
  sourceUrl: string;
  checkedAt: string;
};

export type LineStatusResponse = {
  lines: TrainLineStatus[];
  source: "yahoo-transit";
  fetchedAt: string;
};

export type RailDeparture = {
  time: string;
  scheduled?: string;
  kind: string;
  dest: string;
  /** 遅延分数。source が "schedule" の場合は undefined */
  delay?: number;
  /** データソース: リアルタイム運行情報 or 時刻表補完 */
  source: "realtime" | "schedule";
};

export type RailDeparturesResponse = {
  station: string;
  departures: Record<string, RailDeparture[]>;
};
