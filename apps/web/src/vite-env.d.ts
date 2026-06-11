/// <reference types="vite/client" />

declare module "*.css";

interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_KEIO_BOARDING_STATION?: string;
  readonly VITE_KEIO_DIRECTIONS?: string;
  readonly VITE_WEATHER_LAT?: string;
  readonly VITE_WEATHER_LON?: string;
  readonly VITE_API_ORIGIN?: string;
}
