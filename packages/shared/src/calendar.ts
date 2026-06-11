export type CalendarEvent = {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};

export type CalendarEventsRequest = {
  icsUrls: string[];
  days?: number;
};

export type CalendarEventsResponse = {
  events: CalendarEvent[];
  checkedAt: string;
};
