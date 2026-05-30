import { atomWithStorage } from "jotai/utils";
import { mergedStorage } from "./mergedStorage";

export type TrainsSettings = {
  boardingStation: string;
  displayCount: number;
  watchedLineIds: string[];
};

export const KEIO_STATIONS = [
  "新宿", "笹塚", "代田橋", "明大前", "下高井戸", "桜上水", "上北沢",
  "八幡山", "芦花公園", "千歳烏山", "仙川", "つつじヶ丘", "柴崎", "国領",
  "布田", "調布", "西調布", "飛田給", "武蔵野台", "多磨霊園", "東府中",
  "府中", "分倍河原", "中河原", "聖蹟桜ヶ丘", "百草園", "高幡不動", "南平",
  "平山城址公園", "長沼", "北野", "京王八王子", "新線新宿", "初台", "幡ヶ谷",
  "京王片倉", "山田", "めじろ台", "狭間", "高尾", "高尾山口",
  "京王多摩川", "京王稲田堤", "京王よみうりランド", "稲城", "若葉台",
  "京王永山", "京王多摩センター", "京王堀之内", "南大沢", "多摩境", "橋本",
] as const;

const DEFAULT_TRAINS_SETTINGS: TrainsSettings = {
  boardingStation: "明大前",
  displayCount: 3,
  watchedLineIds: ["keio", "chuo", "sobu", "tama-monorail"],
};

export const trainsSettingsAtom = atomWithStorage<TrainsSettings>(
  "asamiru-trains-settings",
  DEFAULT_TRAINS_SETTINGS,
  mergedStorage(DEFAULT_TRAINS_SETTINGS),
);
