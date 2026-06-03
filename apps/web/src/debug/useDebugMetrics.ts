import { useCallback, useEffect, useState } from "react";
import type { ApiDebugMetrics } from "@asamiru/shared";
import { apiEndpoint } from "../data/apiEndpoint";

const DEBUG_METRICS_ENDPOINT = apiEndpoint("/api/debug/metrics");

type UseDebugMetricsResult = {
  metrics: ApiDebugMetrics | null;
  metricsError: string | null;
  metricsLoading: boolean;
  refreshMetrics: () => Promise<void>;
};

export function useDebugMetrics(
  visible: boolean,
  setExpandedEventId: React.Dispatch<React.SetStateAction<string | null>>,
): UseDebugMetricsResult {
  const [metrics, setMetrics] = useState<ApiDebugMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [autoLoadAttempted, setAutoLoadAttempted] = useState(false);

  const refreshMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const response = await fetch(DEBUG_METRICS_ENDPOINT);
      if (!response.ok) {
        throw new Error(`debug metrics returned ${response.status}`);
      }
      const nextMetrics = (await response.json()) as ApiDebugMetrics;
      setMetrics(nextMetrics);
      setExpandedEventId((current) =>
        current && nextMetrics.events.some((event) => event.id === current) ? current : null,
      );
    } catch (error) {
      setMetricsError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setMetricsLoading(false);
    }
  }, [setExpandedEventId]);

  useEffect(() => {
    if (!visible) {
      setAutoLoadAttempted(false);
      return;
    }
    if (!autoLoadAttempted && !metricsLoading) {
      setAutoLoadAttempted(true);
      void refreshMetrics();
    }
  }, [autoLoadAttempted, metricsLoading, refreshMetrics, visible]);

  return { metrics, metricsError, metricsLoading, refreshMetrics };
}
