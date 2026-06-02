import holiday_jp from "@holiday-jp/holiday_jp";
import rawTimetable from "./data/timetable.json" with { type: "json" };

const SERVICE_DAY_ROLLOVER_MINUTES = 4 * 60;

export type DiakindType = "weekday" | "holiday";

type TimetableEntry = {
  time: string;
  kind: string;
  dest: string;
  trainNo: string;
  isDeparture: boolean;
};

type TimetableDirectionData = {
  weekday: TimetableEntry[];
  holiday: TimetableEntry[];
};

type TimetableData = {
  generatedAt: string;
  revision: { weekday: string; holiday: string };
  stations: Record<string, Record<string, TimetableDirectionData>>;
};

const timetable = rawTimetable as TimetableData;

/**
 * ヶ/ケ・互換漢字・全角括弧付加表記（飛田給（味の素スタジアム前）など）の表記揺れを吸収。
 * 注意: 全角括弧除去は NFKC より先に行うこと。NFKC が （ を ( に変換してしまうため。
 */
function normalizeKey(name: string): string {
  return name
    .replace(/（[^）]*）/g, "")  // 全角括弧付加表記を先に除去 e.g. 飛田給（味の素スタジアム前）
    .normalize("NFKC")
    .replace(/ヶ/g, "ケ")
    .replace(/ヵ/g, "カ")
    .trim();
}

/** 行先名から注記括弧（【】隅付き・〔〕亀甲）を除去した主行先を返す */
export function normalizeDestination(dest: string): string {
  return dest
    .replace(/【[^】]*】/g, "")  // 隅付き括弧 U+3010/3011
    .replace(/〔[^〕]*〕/g, "")  // 亀甲括弧 U+3014/3015
    .trim();
}

/** 時刻文字列 "HH:MM" を運行日分（04:00未満 = +24h）に変換 */
function timetableTimeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Invalid timetable time: ${time}`);
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < SERVICE_DAY_ROLLOVER_MINUTES ? minutes + 24 * 60 : minutes;
}

/** serviceDateKey 形式 "YYYY-MM-DD" の運行日がダイヤ種別を返す */
export function selectDiakind(serviceDateStr: string): DiakindType {
  const [year, month, day] = serviceDateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const dow = date.getDay();
  if (dow === 0 || dow === 6 || holiday_jp.isHoliday(date)) return "holiday";
  return "weekday";
}

/**
 * 指定駅・方向の時刻表補完候補を返す。
 * realtimeTrainIds には既存リアルタイム候補の trainId（trim 済み）を渡して重複排除する。
 * 戻り値のオブジェクトは departures.ts の TrainCandidate 型互換。
 */
export function buildScheduleCandidates(
  boardingStation: string,
  direction: string,
  diakind: DiakindType,
  currentMinutes: number,
  realtimeTrainIds: Set<string>,
): Array<{
  trainId: string;
  direction: string;
  kind: string;
  dest: string;
  scheduledMinutes: number;
  estimatedMinutes: number;
  delay: number;
  source: "schedule";
}> {
  const stationKey = Object.keys(timetable.stations).find(
    (k) => normalizeKey(k) === normalizeKey(boardingStation),
  );
  if (!stationKey) return [];

  const directionData = timetable.stations[stationKey]?.[direction];
  if (!directionData) return [];

  const entries = directionData[diakind];
  const result = [];

  for (const entry of entries) {
    const minutes = timetableTimeToMinutes(entry.time);
    if (minutes < currentMinutes) continue;
    if (realtimeTrainIds.has(entry.trainNo)) continue;

    result.push({
      trainId: entry.trainNo,
      direction,
      kind: entry.kind,
      dest: entry.dest,
      scheduledMinutes: minutes,
      estimatedMinutes: minutes,
      delay: 0,
      source: "schedule" as const,
    });
  }

  result.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
  return result;
}
