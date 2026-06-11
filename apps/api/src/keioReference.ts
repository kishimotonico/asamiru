/**
 * 京王線固有の参照データ（駅順序・分岐線駅/行先コード・種別/行先コードの表示名変換）。
 * departures.ts / timetable.ts から参照する。
 */

export const STATION_ORDER_BY_NAME: ReadonlyMap<string, number> = new Map(
  [
    ["新宿", 1],
    ["笹塚", 2],
    ["代田橋", 3],
    ["明大前", 4],
    ["下高井戸", 5],
    ["桜上水", 6],
    ["上北沢", 7],
    ["八幡山", 8],
    ["芦花公園", 9],
    ["千歳烏山", 10],
    ["仙川", 11],
    ["つつじヶ丘", 12],
    ["柴崎", 13],
    ["国領", 14],
    ["布田", 15],
    ["調布", 16],
    ["西調布", 17],
    ["飛田給", 18],
    ["武蔵野台", 19],
    ["多磨霊園", 20],
    ["東府中", 21],
    ["府中", 22],
    ["分倍河原", 23],
    ["中河原", 24],
    ["聖蹟桜ヶ丘", 25],
    ["百草園", 26],
    ["高幡不動", 27],
    ["南平", 28],
    ["平山城址公園", 29],
    ["長沼", 30],
    ["北野", 31],
    ["京王八王子", 32],
    ["新線新宿", 33],
    ["初台", 34],
    ["幡ヶ谷", 35],
    ["京王片倉", 38],
    ["山田", 39],
    ["めじろ台", 40],
    ["狭間", 41],
    ["高尾", 42],
    ["高尾山口", 43],
    ["京王多摩川", 44],
    ["京王稲田堤", 45],
    ["京王よみうりランド", 46],
    ["稲城", 47],
    ["若葉台", 48],
    ["京王永山", 49],
    ["京王多摩センター", 50],
    ["京王堀之内", 51],
    ["南大沢", 52],
    ["多摩境", 53],
    ["橋本", 54],
  ] as const,
);

export const SAGAMIHARA_LINE_DESTINATIONS = new Set(["048", "054"]);
export const HACHIOJI_TAKAO_DESTINATIONS = new Set(["027", "032", "036", "037", "043"]);

export const SAGAMIHARA_LINE_STATIONS = new Set([
  "京王多摩川",
  "京王稲田堤",
  "京王よみうりランド",
  "稲城",
  "若葉台",
  "京王永山",
  "京王多摩センター",
  "京王堀之内",
  "南大沢",
  "多摩境",
  "橋本",
]);

export const HACHIOJI_TAKAO_LINE_STATIONS = new Set([
  "西調布",
  "飛田給",
  "武蔵野台",
  "多磨霊園",
  "東府中",
  "府中",
  "分倍河原",
  "中河原",
  "聖蹟桜ヶ丘",
  "百草園",
  "高幡不動",
  "南平",
  "平山城址公園",
  "長沼",
  "北野",
  "京王八王子",
  "京王片倉",
  "山田",
  "めじろ台",
  "狭間",
  "高尾",
  "高尾山口",
]);

export function serviceLabel(code: string | undefined): string {
  switch (code) {
    case "1":
      return "特急";
    case "2":
      return "急行";
    case "3":
      return "快速";
    case "4":
      return "準特急";
    case "5":
      return "区間急行";
    case "6":
      return "各駅停車";
    case "7":
      return "回送";
    case "9":
      return "京王ライナー";
    case "10":
      return "臨時";
    case "11":
      return "Mt.TAKAO号";
    default:
      return code ? `種別${code}` : "不明";
  }
}

export function destinationLabel(code: string | undefined): string {
  switch (code) {
    case "001":
      return "新宿";
    case "027":
      return "高幡不動";
    case "032":
      return "京王八王子";
    case "036":
      return "高幡不動";
    case "037":
      return "北野";
    case "043":
      return "高尾山口";
    case "048":
      return "橋本";
    case "054":
      return "橋本";
    case "081":
      return "渋谷";
    case "097":
      return "吉祥寺";
    case "120":
      return "本八幡";
    case "301":
      return "新線新宿";
    default:
      return code ? `行先${code}` : "不明";
  }
}
