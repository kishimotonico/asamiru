import { MASTER_TRAIN_LINES } from "@asamiru/shared";
import type { RailCatalog } from "./types";

// ─── 本番鉄道カタログ ──────────────────────────────────────────────────────

const KEIO_STATIONS: string[] = [
  "新宿", "笹塚", "代田橋", "明大前", "下高井戸", "桜上水", "上北沢",
  "八幡山", "芦花公園", "千歳烏山", "仙川", "つつじヶ丘", "柴崎", "国領",
  "布田", "調布", "西調布", "飛田給", "武蔵野台", "多磨霊園", "東府中",
  "府中", "分倍河原", "中河原", "聖蹟桜ヶ丘", "百草園", "高幡不動", "南平",
  "平山城址公園", "長沼", "北野", "京王八王子", "新線新宿", "初台", "幡ヶ谷",
  "京王片倉", "山田", "めじろ台", "狭間", "高尾", "高尾山口",
  "京王多摩川", "京王稲田堤", "京王よみうりランド", "稲城", "若葉台",
  "京王永山", "京王多摩センター", "京王堀之内", "南大沢", "多摩境", "橋本",
];

export const RAIL_CATALOG: RailCatalog = {
  stations: KEIO_STATIONS,
  lines: MASTER_TRAIN_LINES,
  defaults: {
    boardingStation: "明大前",
    displayCount: 3,
    watchedLines: [
      { name: "京王線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/102/0" },
      { name: "中央線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/38/0" },
      { name: "総武線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/40/0" },
      { name: "多摩都市モノレール線", yahooUrl: "https://transit.yahoo.co.jp/diainfo/156/0" },
    ],
  },
};
