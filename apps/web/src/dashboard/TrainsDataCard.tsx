import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { TrainsCard } from "./TrainsCard";
import { departuresQueryOptions, lineStatusQueryOptions } from "./dashboardQueries";
import { trainsSettingsAtom } from "../settings/trainsSettingsAtom";

/**
 * 発車情報と路線運行情報を取得して TrainsCard に渡す接続コンポーネント。
 * 表示本数はサーバー側（fetchDepartures）で既に displayCount にキャップ済みのため、
 * ここでは再度 slice しない。
 */
export function TrainsDataCard({ className }: { className?: string }) {
  const settings = useAtomValue(trainsSettingsAtom);
  const departures = useSuspenseQuery(departuresQueryOptions(settings));
  const lineStatus = useQuery(lineStatusQueryOptions(settings.watchedLines));
  return (
    <TrainsCard
      data={{ ...departures.data, lines: lineStatus.data?.lines ?? [] }}
      error={departures.error ?? lineStatus.error}
      refreshing={departures.isFetching || lineStatus.isFetching}
      className={className}
    />
  );
}
