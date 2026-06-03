import type { ApiDebugEvent } from "@asamiru/shared";

export function formatTime(value: string | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDuration(value: number | undefined): string {
  return typeof value === "number" ? `${value}ms` : "-";
}

export function formatJson(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{\n  \"error\": \"detail could not be serialized\"\n}";
  }
}

export function kindLabel(kind: ApiDebugEvent["kind"]): string {
  switch (kind) {
    case "backend_request":
      return "backend";
    case "upstream_request":
      return "upstream";
    case "cache_hit":
      return "cache_hit";
    case "cache_miss":
      return "cache_miss";
    case "calculation":
      return "calculation";
    case "error":
      return "error";
  }
}

export function kindClassName(kind: ApiDebugEvent["kind"]): string {
  switch (kind) {
    case "backend_request":
      return "bg-sky-400/15 text-sky-200";
    case "upstream_request":
      return "bg-violet-400/15 text-violet-200";
    case "cache_hit":
      return "bg-emerald-400/15 text-emerald-200";
    case "cache_miss":
      return "bg-amber-400/15 text-amber-200";
    case "calculation":
      return "bg-white/10 text-white/65";
    case "error":
      return "bg-red-400/15 text-red-200";
  }
}
