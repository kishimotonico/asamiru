export type TrainStatusLevel = "ok" | "warn" | "info";

export type WatchedTrainLine = {
  id: string;
  name: string;
  yahooUrl: string;
};

export type TrainLineStatus = {
  id: string;
  name: string;
  status: string;
  level: TrainStatusLevel;
  note?: string;
  sourceUrl: string;
  checkedAt: string;
};

export type TrainStatusResponse = {
  lines: TrainLineStatus[];
  source: "yahoo-transit";
  fetchedAt: string;
};

export const watchedTrainLines = [
  {
    id: "keio",
    name: "京王線",
    yahooUrl: "https://transit.yahoo.co.jp/diainfo/102/0",
  },
  {
    id: "chuo",
    name: "中央線",
    yahooUrl: "https://transit.yahoo.co.jp/diainfo/38/0",
  },
  {
    id: "sobu",
    name: "総武線",
    yahooUrl: "https://transit.yahoo.co.jp/diainfo/40/0",
  },
  {
    id: "tama-monorail",
    name: "多摩モノレール",
    yahooUrl: "https://transit.yahoo.co.jp/diainfo/137/0",
  },
] as const satisfies readonly WatchedTrainLine[];
