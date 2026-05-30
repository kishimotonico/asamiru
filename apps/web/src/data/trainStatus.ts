import type { TrainStatusResponse } from "@asamiru/shared";

const TRAIN_STATUS_ENDPOINT = `${import.meta.env.VITE_API_ORIGIN ?? ""}/api/train-status`;

export async function fetchTrainStatus({ signal }: { signal?: AbortSignal } = {}): Promise<TrainStatusResponse> {
  const response = await fetch(TRAIN_STATUS_ENDPOINT, { signal });
  if (!response.ok) {
    throw new Error(`Train status API returned ${response.status}`);
  }

  return (await response.json()) as TrainStatusResponse;
}
