import type { DashboardData, ForecastDay, WeatherIconKind } from "../dashboard/types";

type OpenMeteoResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    weather_code?: number[];
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
};

const WEATHER_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_LAT = 35.6895;
const DEFAULT_LON = 139.6917;
const HOURLY_HOURS = new Set([6, 9, 12, 15, 18, 21]);
const WEATHER_TTL_MS = 10 * 60 * 1000;

let weatherCache: { value: DashboardData["weather"]; expiresAt: number } | undefined;
let weatherInflight: Promise<DashboardData["weather"]> | undefined;

export async function fetchWeather(): Promise<DashboardData["weather"]> {
  const cached = weatherCache;
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (weatherInflight) {
    return weatherInflight;
  }

  const lat = readNumberEnv(import.meta.env.VITE_WEATHER_LAT, DEFAULT_LAT);
  const lon = readNumberEnv(import.meta.env.VITE_WEATHER_LON, DEFAULT_LON);
  const url = new URL(WEATHER_ENDPOINT);

  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("timezone", "Asia/Tokyo");
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");

  weatherInflight = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Open-Meteo returned ${response.status}`);
      }

      const raw = (await response.json()) as OpenMeteoResponse;
      const value = normalizeWeather(raw);
      weatherCache = { value, expiresAt: Date.now() + WEATHER_TTL_MS };
      return value;
    })
    .finally(() => {
      weatherInflight = undefined;
    });

  return weatherInflight;
}

function normalizeWeather(raw: OpenMeteoResponse): DashboardData["weather"] {
  const hourly = raw.hourly;
  const daily = raw.daily;

  if (!hourly?.time || !hourly.temperature_2m || !hourly.precipitation_probability || !hourly.weather_code) {
    throw new Error("Open-Meteo hourly response is incomplete");
  }

  if (
    !daily?.time ||
    !daily.weather_code ||
    !daily.temperature_2m_max ||
    !daily.temperature_2m_min ||
    !daily.precipitation_probability_max
  ) {
    throw new Error("Open-Meteo daily response is incomplete");
  }

  const todayKey = formatDateKey(new Date());
  const todayDailyIndex = daily.time.findIndex((date) => date === todayKey);
  const todayIndex = todayDailyIndex >= 0 ? todayDailyIndex : 0;
  const tomorrowIndex = todayIndex + 1;
  const dayAfterIndex = todayIndex + 2;
  const todayHourlyIndexes = hourly.time
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => {
      const hour = Number(time.slice(11, 13));
      return time.startsWith(todayKey) && HOURLY_HOURS.has(hour);
    })
    .slice(0, 6);

  if (todayHourlyIndexes.length === 0) {
    throw new Error("Open-Meteo hourly response has no usable forecast for today");
  }

  return {
    location: "東京",
    today: {
      label: weatherLabel(readNumber(daily.weather_code[todayIndex])),
      high: roundTemperature(daily.temperature_2m_max[todayIndex]),
      low: roundTemperature(daily.temperature_2m_min[todayIndex]),
      pop: roundPercent(daily.precipitation_probability_max[todayIndex]),
      hourly: todayHourlyIndexes.map(({ time, index }) => ({
        h: time.slice(11, 13),
        icon: weatherIcon(readNumber(hourly.weather_code?.[index])),
        temp: roundTemperature(hourly.temperature_2m?.[index]),
        pop: roundPercent(hourly.precipitation_probability?.[index]),
      })),
    },
    tomorrow: normalizeForecastDay(daily, tomorrowIndex),
    dayAfter: normalizeForecastDay(daily, dayAfterIndex),
  };
}

function normalizeForecastDay(daily: Required<OpenMeteoResponse>["daily"], index: number): ForecastDay {
  if (!daily.time?.[index]) {
    throw new Error("Open-Meteo daily response has fewer forecast days than expected");
  }

  return {
    label: weatherLabel(readNumber(daily.weather_code?.[index])),
    icon: weatherIcon(readNumber(daily.weather_code?.[index])),
    high: roundTemperature(daily.temperature_2m_max?.[index]),
    low: roundTemperature(daily.temperature_2m_min?.[index]),
    pop: roundPercent(daily.precipitation_probability_max?.[index]),
    weekday: weekdayText(new Date(`${daily.time[index]}T00:00:00+09:00`)),
  };
}

function readNumber(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Open-Meteo response contains an invalid number");
  }
  return value;
}

function readNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric env value: ${value}`);
  }
  return parsed;
}

function roundTemperature(value: number | undefined): number {
  return Math.round(readNumber(value));
}

function roundPercent(value: number | undefined): number {
  return Math.round(readNumber(value));
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekdayText(date: Date): string {
  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()] ?? "";
}

function weatherIcon(code: number): WeatherIconKind {
  if (code === 0) {
    return "sun";
  }
  if (code === 1 || code === 2) {
    return "partly";
  }
  if (code === 3 || code === 45 || code === 48) {
    return "cloud";
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code === 95 || code === 96 || code === 99) {
    return "rain";
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return "snow";
  }
  return "cloud";
}

function weatherLabel(code: number): string {
  if (code === 0) {
    return "晴れ";
  }
  if (code === 1 || code === 2) {
    return "晴れ時々曇り";
  }
  if (code === 3) {
    return "曇り";
  }
  if (code === 45 || code === 48) {
    return "霧";
  }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return "雨";
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return "雪";
  }
  if (code === 95 || code === 96 || code === 99) {
    return "雷雨";
  }
  return "不明";
}
