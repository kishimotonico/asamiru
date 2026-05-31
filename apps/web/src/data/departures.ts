import type { RailDeparturesResponse } from "@asamiru/shared";

const DEPARTURES_ENDPOINT = `${import.meta.env.VITE_API_ORIGIN ?? ""}/api/rail/departures`;

export async function fetchDepartures(
  {
    boardingStation,
    displayCount,
    signal,
  }: {
    boardingStation: string;
    displayCount: number;
    signal?: AbortSignal;
  },
): Promise<RailDeparturesResponse> {
  const response = await fetch(DEPARTURES_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boardingStation, displayCount }),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Departures API returned ${response.status}`);
  }

  return (await response.json()) as RailDeparturesResponse;
}
