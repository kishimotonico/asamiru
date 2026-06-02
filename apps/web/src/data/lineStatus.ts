import type { LineStatusResponse, WatchedLine } from "@asamiru/shared";
import { apiEndpoint } from "./apiEndpoint";

const LINE_STATUS_ENDPOINT = apiEndpoint("/api/rail/line-status");

export async function fetchLineStatus(
  lines: WatchedLine[],
  { signal }: { signal?: AbortSignal } = {},
): Promise<LineStatusResponse> {
  const response = await fetch(LINE_STATUS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Line status API returned ${response.status}`);
  }

  return (await response.json()) as LineStatusResponse;
}
