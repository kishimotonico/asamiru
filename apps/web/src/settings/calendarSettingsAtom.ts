import { atomWithStorage } from "jotai/utils";
import { mergedStorage } from "./mergedStorage";

export type CalendarSettings = {
  icsUrls: string[];
};

const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = {
  icsUrls: [],
};

export const calendarSettingsAtom = atomWithStorage<CalendarSettings>(
  "asamiru-calendar-settings",
  DEFAULT_CALENDAR_SETTINGS,
  mergedStorage(DEFAULT_CALENDAR_SETTINGS),
  { getOnInit: true },
);
