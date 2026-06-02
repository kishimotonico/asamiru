export function apiEndpoint(path: `/api/${string}`): string {
  const origin = import.meta.env.DEV ? import.meta.env.VITE_API_ORIGIN : "";
  return `${origin ?? ""}${path}`;
}
