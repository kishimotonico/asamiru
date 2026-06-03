import type { RailDeparture, TrainLineStatus } from "@asamiru/shared";

export type WeatherIconKind = "sun" | "cloud" | "partly" | "rain" | "snow";

export type ForecastDay = {
  label: string;
  icon: WeatherIconKind;
  high: number;
  low: number;
  pop: number;
  weekday: string;
};

export type WeatherData = {
  location: string;
  today: {
    label: string;
    high: number;
    low: number;
    pop: number;
    hourly: Array<{
      h: string;
      icon: WeatherIconKind;
      temp: number;
      pop: number;
    }>;
  };
  tomorrow: ForecastDay;
  dayAfter: ForecastDay;
};

export type TrainsData = {
  station: string;
  departures: Record<string, RailDeparture[]>;
  lines: TrainLineStatus[];
};
