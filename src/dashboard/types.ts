export type WeatherIconKind = "sun" | "cloud" | "partly" | "rain" | "snow";

export type DashboardData = {
  now: {
    time: string;
    date: {
      y: number;
      m: number;
      d: number;
      weekday: string;
    };
    holiday?: string;
  };
  weather: {
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
  trains: {
    station: string;
    departures: Record<
      string,
      Array<{
        time: string;
        scheduled?: string;
        kind: string;
        dest: string;
        delay: number;
      }>
    >;
    lines: Array<{
      name: string;
      status: string;
      level: "ok" | "warn" | "info";
      note?: string;
    }>;
  };
  schedule: {
    today: ScheduleEvent[];
    upcoming: ScheduleEvent[];
  };
};

export type ForecastDay = {
  label: string;
  icon: WeatherIconKind;
  high: number;
  low: number;
  pop: number;
  weekday: string;
};

export type ScheduleEvent = {
  date?: string;
  when?: string;
  time?: string;
  title: string;
};
