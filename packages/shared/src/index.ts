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

export type TrainStatusResponse = {
  lines: TrainLineStatus[];
  source: "yahoo-transit";
  fetchedAt: string;
};

export const MASTER_TRAIN_LINES: WatchedLine[] = [
  { name: "京王線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/102/0" },
  { name: "京王相模原線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/112/0" },
  { name: "井の頭線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/116/0" },
  { name: "小田急線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/128/0" },
  { name: "東急東横線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/106/0" },
  { name: "東急田園都市線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/107/0" },
  { name: "東急目黒線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/108/0" },
  { name: "多摩モノレール", yahooUrl: "https://transit.yahoo.co.jp/diainfo/137/0" },
  { name: "JR山手線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/23/0" },
  { name: "JR中央線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/38/0" },
  { name: "JR総武線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/40/0" },
  { name: "JR南武線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/34/0" },
  { name: "JR埼京線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/35/0" },
  { name: "JR横浜線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/36/0" },
  { name: "東京メトロ銀座線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/152/0" },
  { name: "東京メトロ丸ノ内線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/153/0" },
  { name: "東京メトロ千代田線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/158/0" },
  { name: "東京メトロ半蔵門線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/161/0" },
  { name: "都営新宿線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/201/0" },
  { name: "都営三田線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/200/0" },
];
