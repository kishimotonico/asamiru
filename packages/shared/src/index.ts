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

export type TrainStatusResponse = LineStatusResponse;

export type RailDeparture = {
  time: string;
  scheduled?: string;
  kind: string;
  dest: string;
  delay: number;
};

export type RailDeparturesResponse = {
  station: string;
  departures: Record<string, RailDeparture[]>;
};

export type ApiDebugMetrics = {
  lineStatus: {
    requests: number;
    cacheHits: number;
    cacheMisses: number;
    upstreamRequests: number;
    lastFetchAt?: string;
  };
  departures: {
    requests: number;
    trafficRequests: number;
    trafficCacheHits: number;
    trafficCacheMisses: number;
    diaRequests: number;
    diaCacheHits: number;
    diaCacheMisses: number;
    stopCacheHits: number;
    stopCacheMisses: number;
    lastTrafficFetchAt?: string;
    lastCalculatedAt?: string;
  };
  events: ApiDebugEvent[];
  lastUpdatedAt: string;
};

export type ApiDebugEvent = {
  at: string;
  area: "api" | "lineStatus" | "departures";
  event: string;
  detail?: string;
};

function line(name: string, id: number): WatchedLine {
  return { name, yahooUrl: `https://transit.yahoo.co.jp/diainfo/${id}/0` };
}

export const MASTER_TRAIN_LINES: WatchedLine[] = [
  // JR
  line("JR山手線", 21),
  line("JR湘南新宿ライン", 25),
  line("JR上野東京ライン", 627),
  line("JR中央線（快速）", 38),
  line("JR中央・総武線（各停）", 40),
  line("JR埼京・川越線", 50),
  line("JR横浜線", 31),
  line("JR南武線", 34),
  line("JR常磐線（快速）", 57),
  line("JR常磐線（各停）", 58),
  line("JR総武線（快速）", 61),
  line("JR京葉線", 69),
  line("JR武蔵野線", 71),
  // 京王
  line("京王線", 102),
  line("京王新線", 103),
  line("京王相模原線", 104),
  line("京王高尾線", 105),
  line("京王井の頭線", 108),
  // 小田急
  line("小田急小田原線", 109),
  line("小田急江ノ島線", 110),
  line("小田急多摩線", 111),
  // 東急
  line("東急東横線", 112),
  line("東急目黒線", 113),
  line("東急田園都市線", 114),
  line("東急大井町線", 115),
  line("東急新横浜線", 641),
  // 京急
  line("京急本線", 120),
  line("京急空港線", 121),
  // 相鉄
  line("相鉄線", 125),
  // 東武
  line("東武スカイツリーライン", 77),
  line("東武東上線", 82),
  line("東武アーバンパークライン", 81),
  // 西武
  line("西武池袋・秩父線", 84),
  line("西武新宿線", 86),
  // 京成
  line("京成本線", 96),
  // 都営
  line("都営浅草線", 128),
  line("都営三田線", 129),
  line("都営新宿線", 130),
  line("都営大江戸線", 131),
  // 東京メトロ
  line("東京メトロ銀座線", 132),
  line("東京メトロ丸ノ内線", 133),
  line("東京メトロ日比谷線", 134),
  line("東京メトロ東西線", 135),
  line("東京メトロ千代田線", 136),
  line("東京メトロ有楽町線", 137),
  line("東京メトロ半蔵門線", 138),
  line("東京メトロ南北線", 139),
  line("東京メトロ副都心線", 540),
  // その他
  line("みなとみらい線", 401),
  line("つくばエクスプレス線", 412),
  line("多摩都市モノレール線", 156),
  line("東京モノレール線", 154),
  line("りんかい線", 144),
  line("ゆりかもめ線", 160),
  line("日暮里・舎人ライナー", 541),
];
