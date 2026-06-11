import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeForecastDay,
  normalizeWeather,
  weatherIcon,
  weatherLabel,
  type OpenMeteoResponse,
} from "./weather";

describe("weatherIcon", () => {
  it("0 は sun", () => {
    expect(weatherIcon(0)).toBe("sun");
  });

  it("1, 2 は partly", () => {
    expect(weatherIcon(1)).toBe("partly");
    expect(weatherIcon(2)).toBe("partly");
  });

  it("3 と霧(45, 48) は cloud", () => {
    expect(weatherIcon(3)).toBe("cloud");
    expect(weatherIcon(45)).toBe("cloud");
    expect(weatherIcon(48)).toBe("cloud");
  });

  it("51-67 は雨の範囲（境界含む）", () => {
    expect(weatherIcon(50)).toBe("cloud");
    expect(weatherIcon(51)).toBe("rain");
    expect(weatherIcon(67)).toBe("rain");
    expect(weatherIcon(68)).toBe("cloud");
  });

  it("80-82 は雨の範囲（境界含む）", () => {
    expect(weatherIcon(79)).toBe("cloud");
    expect(weatherIcon(80)).toBe("rain");
    expect(weatherIcon(82)).toBe("rain");
    expect(weatherIcon(83)).toBe("cloud");
  });

  it("95, 96, 99 は rain", () => {
    expect(weatherIcon(95)).toBe("rain");
    expect(weatherIcon(96)).toBe("rain");
    expect(weatherIcon(99)).toBe("rain");
    expect(weatherIcon(97)).toBe("cloud");
    expect(weatherIcon(98)).toBe("cloud");
  });

  it("71-77, 85, 86 は雪の範囲（境界含む）", () => {
    expect(weatherIcon(70)).toBe("cloud");
    expect(weatherIcon(71)).toBe("snow");
    expect(weatherIcon(77)).toBe("snow");
    expect(weatherIcon(78)).toBe("cloud");
    expect(weatherIcon(85)).toBe("snow");
    expect(weatherIcon(86)).toBe("snow");
    expect(weatherIcon(84)).toBe("cloud");
    expect(weatherIcon(87)).toBe("cloud");
  });

  it("未知のコードは cloud にフォールバックする", () => {
    expect(weatherIcon(4)).toBe("cloud");
    expect(weatherIcon(100)).toBe("cloud");
  });
});

describe("weatherLabel", () => {
  it("0 は晴れ", () => {
    expect(weatherLabel(0)).toBe("晴れ");
  });

  it("1, 2 は晴れ時々曇り", () => {
    expect(weatherLabel(1)).toBe("晴れ時々曇り");
    expect(weatherLabel(2)).toBe("晴れ時々曇り");
  });

  it("3 は曇り", () => {
    expect(weatherLabel(3)).toBe("曇り");
  });

  it("45, 48 は霧（weatherIcon の cloud とは別ラベル）", () => {
    expect(weatherLabel(45)).toBe("霧");
    expect(weatherLabel(48)).toBe("霧");
  });

  it("51-67, 80-82 は雨の範囲（境界含む）", () => {
    expect(weatherLabel(50)).toBe("不明");
    expect(weatherLabel(51)).toBe("雨");
    expect(weatherLabel(67)).toBe("雨");
    expect(weatherLabel(68)).toBe("不明");
    expect(weatherLabel(79)).toBe("不明");
    expect(weatherLabel(80)).toBe("雨");
    expect(weatherLabel(82)).toBe("雨");
    expect(weatherLabel(83)).toBe("不明");
  });

  it("71-77, 85, 86 は雪の範囲（境界含む）", () => {
    expect(weatherLabel(70)).toBe("不明");
    expect(weatherLabel(71)).toBe("雪");
    expect(weatherLabel(77)).toBe("雪");
    expect(weatherLabel(78)).toBe("不明");
    expect(weatherLabel(85)).toBe("雪");
    expect(weatherLabel(86)).toBe("雪");
    expect(weatherLabel(84)).toBe("不明");
    expect(weatherLabel(87)).toBe("不明");
  });

  it("95, 96, 99 は雷雨（weatherIcon の rain とは別ラベル）", () => {
    expect(weatherLabel(95)).toBe("雷雨");
    expect(weatherLabel(96)).toBe("雷雨");
    expect(weatherLabel(99)).toBe("雷雨");
  });

  it("未知のコードは不明にフォールバックする", () => {
    expect(weatherLabel(4)).toBe("不明");
    expect(weatherLabel(100)).toBe("不明");
  });
});

const HOURS = ["00", "03", "06", "09", "12", "15", "18", "21"] as const;

function buildHourlyTime(dates: string[]): string[] {
  return dates.flatMap((date) => HOURS.map((h) => `${date}T${h}:00`));
}

function buildOpenMeteoFixture(): OpenMeteoResponse {
  const dates = ["2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13"];
  const time = buildHourlyTime(dates);
  // 各日8コマ（00,03,06,09,12,15,18,21）。weather_code/temperature/popは index に応じた決定的な値。
  const weatherCode = time.map((_, i) => [0, 1, 3, 61, 71, 80, 95, 45][i % 8]);
  const temperature = time.map((_, i) => 10 + i);
  const pop = time.map((_, i) => i * 2);

  return {
    hourly: {
      time,
      temperature_2m: temperature,
      precipitation_probability: pop,
      weather_code: weatherCode,
    },
    daily: {
      time: dates,
      weather_code: [3, 0, 61, 71],
      temperature_2m_max: [20, 25, 18, 10],
      temperature_2m_min: [10, 15, 8, 2],
      precipitation_probability_max: [10, 0, 80, 90],
    },
  };
}

describe("normalizeWeather", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 2026-06-11 08:00 (JST) を「今日」として固定
    vi.setSystemTime(new Date(2026, 5, 11, 8, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Open-Meteoの固定JSONを画面用構造へ変換する", () => {
    const raw = buildOpenMeteoFixture();
    const result = normalizeWeather(raw, "東京");

    expect(result.location).toBe("東京");

    // today は daily.time の "2026-06-11"（index 1）
    expect(result.today.label).toBe(weatherLabel(0)); // daily.weather_code[1] = 0
    expect(result.today.high).toBe(25);
    expect(result.today.low).toBe(15);
    expect(result.today.pop).toBe(0);

    // tomorrow / dayAfter は index 2, 3
    expect(result.tomorrow.high).toBe(18);
    expect(result.tomorrow.low).toBe(8);
    expect(result.dayAfter.high).toBe(10);
    expect(result.dayAfter.low).toBe(2);
  });

  it("hourly は当日の 6/9/12/15/18/21 時のみを順番にピックする", () => {
    const raw = buildOpenMeteoFixture();
    const result = normalizeWeather(raw, "東京");

    expect(result.today.hourly.map((h) => h.h)).toEqual(["06", "09", "12", "15", "18", "21"]);
    expect(result.today.hourly).toHaveLength(6);

    // 2026-06-11 のブロックは hourly.time の index 8-15 (00,03,06,09,12,15,18,21)
    // 06 -> index 10, weatherCode[10] = weatherCode[10 % 8] = weatherCode[2] = 3 -> cloud
    expect(result.today.hourly[0]).toEqual({
      h: "06",
      icon: weatherIcon(3),
      temp: 10 + 10,
      pop: 10 * 2,
    });
    // 21 -> index 15, weatherCode[15 % 8] = weatherCode[7] = 45 -> cloud
    expect(result.today.hourly[5]).toEqual({
      h: "21",
      icon: weatherIcon(45),
      temp: 10 + 15,
      pop: 15 * 2,
    });
  });

  it("daily.time に今日の日付が無い場合は index 0 をtodayとして扱う", () => {
    const raw = buildOpenMeteoFixture();
    raw.daily!.time = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"];
    const result = normalizeWeather(raw, "東京");

    expect(result.today.high).toBe(20); // daily.temperature_2m_max[0]
    expect(result.tomorrow.high).toBe(25); // index 1
    expect(result.dayAfter.high).toBe(18); // index 2
  });

  it("hourly が欠損している場合は throw する", () => {
    const raw = buildOpenMeteoFixture();
    delete raw.hourly;
    expect(() => normalizeWeather(raw, "東京")).toThrow("Open-Meteo hourly response is incomplete");
  });

  it("hourly の各配列のいずれかが欠けている場合は throw する", () => {
    const raw = buildOpenMeteoFixture();
    delete raw.hourly!.weather_code;
    expect(() => normalizeWeather(raw, "東京")).toThrow("Open-Meteo hourly response is incomplete");
  });

  it("daily が欠損している場合は throw する", () => {
    const raw = buildOpenMeteoFixture();
    delete raw.daily;
    expect(() => normalizeWeather(raw, "東京")).toThrow("Open-Meteo daily response is incomplete");
  });

  it("当日の対象時刻（6/9/12/15/18/21時）が無い場合は throw する", () => {
    const raw = buildOpenMeteoFixture();
    // 当日分の hourly エントリを全て別日に差し替える
    raw.hourly!.time = raw.hourly!.time!.map((t) => t.replace("2026-06-11", "2099-01-01"));
    expect(() => normalizeWeather(raw, "東京")).toThrow(
      "Open-Meteo hourly response has no usable forecast for today",
    );
  });
});

describe("normalizeForecastDay", () => {
  function dailyFixture(): Required<OpenMeteoResponse>["daily"] {
    return {
      time: ["2026-06-11", "2026-06-12"],
      weather_code: [0, 61],
      temperature_2m_max: [25, 18],
      temperature_2m_min: [15, 8],
      precipitation_probability_max: [0, 80],
    };
  }

  it("有効な index は画面用 ForecastDay に変換される", () => {
    const daily = dailyFixture();
    const result = normalizeForecastDay(daily, 1);

    expect(result).toEqual({
      label: weatherLabel(61),
      icon: weatherIcon(61),
      high: 18,
      low: 8,
      pop: 80,
      weekday: expect.any(String),
    });
  });

  it("範囲外の index は throw する", () => {
    const daily = dailyFixture();
    expect(() => normalizeForecastDay(daily, 2)).toThrow(
      "Open-Meteo daily response has fewer forecast days than expected",
    );
  });
});
