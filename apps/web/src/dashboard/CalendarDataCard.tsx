import { useSuspenseQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { calendarSettingsAtom } from "../settings/calendarSettingsAtom";
import { CalendarCard } from "./CalendarCard";
import { calendarEventsQueryOptions } from "./dashboardQueries";

export function CalendarDataCard({ className }: { className?: string }) {
  const settings = useAtomValue(calendarSettingsAtom);
  if (settings.icsUrls.length === 0) {
    return <CalendarCard events={[]} className={className} />;
  }
  return <ConfiguredCalendarDataCard icsUrls={settings.icsUrls} className={className} />;
}

function ConfiguredCalendarDataCard({ icsUrls, className }: { icsUrls: string[]; className?: string }) {
  const calendar = useSuspenseQuery(calendarEventsQueryOptions(icsUrls));
  return (
    <CalendarCard
      events={calendar.data.events}
      error={calendar.error}
      refreshing={calendar.isFetching}
      className={className}
    />
  );
}
