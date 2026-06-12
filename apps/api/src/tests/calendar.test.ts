import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCalendarCache, fetchCalendarEvents, normalizeCalendarUrl, parseCalendarEvents } from "../calendar.js";

const NOW = new Date("2026-06-11T08:00:00+09:00");

const FIXTURE = `BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//asamiru//calendar test//EN\r
BEGIN:VEVENT\r
UID:single@example.com\r
DTSTAMP:20260601T000000Z\r
DTSTART:20260611T003000Z\r
DTEND:20260611T013000Z\r
SUMMARY:単発予定\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:recurring@example.com\r
DTSTAMP:20260601T000000Z\r
DTSTART;TZID=Asia/Tokyo:20260611T100000\r
DTEND;TZID=Asia/Tokyo:20260611T103000\r
RRULE:FREQ=DAILY;COUNT=3\r
SUMMARY:繰り返し予定\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:all-day@example.com\r
DTSTAMP:20260601T000000Z\r
DTSTART;VALUE=DATE:20260612\r
DTEND;VALUE=DATE:20260613\r
SUMMARY:終日予定\r
END:VEVENT\r
BEGIN:VEVENT\r
UID:timezone@example.com\r
DTSTAMP:20260601T000000Z\r
DTSTART;TZID=America/New_York:20260612T090000\r
DTEND;TZID=America/New_York:20260612T100000\r
SUMMARY:タイムゾーン予定\r
END:VEVENT\r
END:VCALENDAR\r
`;

afterEach(() => {
  clearCalendarCache();
  vi.restoreAllMocks();
});

describe("parseCalendarEvents", () => {
  it("単発・繰り返し・終日・TZID 予定を JST に正規化する", () => {
    const events = parseCalendarEvents(FIXTURE, { now: NOW, days: 3 });

    expect(events).toEqual([
      {
        title: "単発予定",
        start: "2026-06-11T09:30:00.000+09:00",
        end: "2026-06-11T10:30:00.000+09:00",
        allDay: false,
      },
      {
        title: "繰り返し予定",
        start: "2026-06-11T10:00:00.000+09:00",
        end: "2026-06-11T10:30:00.000+09:00",
        allDay: false,
      },
      {
        title: "終日予定",
        start: "2026-06-12T00:00:00.000+09:00",
        end: "2026-06-13T00:00:00.000+09:00",
        allDay: true,
      },
      {
        title: "繰り返し予定",
        start: "2026-06-12T10:00:00.000+09:00",
        end: "2026-06-12T10:30:00.000+09:00",
        allDay: false,
      },
      {
        title: "タイムゾーン予定",
        start: "2026-06-12T22:00:00.000+09:00",
        end: "2026-06-12T23:00:00.000+09:00",
        allDay: false,
      },
      {
        title: "繰り返し予定",
        start: "2026-06-13T10:00:00.000+09:00",
        end: "2026-06-13T10:30:00.000+09:00",
        allDay: false,
      },
    ]);
  });

  it("範囲外の予定を除外する", () => {
    const events = parseCalendarEvents(FIXTURE, { now: NOW, days: 1 });
    expect(events.map((event) => event.title)).toEqual(["単発予定", "繰り返し予定"]);
  });

  it("14日範囲では7日後を含み、14日後を除外する", () => {
    const fixture = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:week-later\r\nDTSTART;TZID=Asia/Tokyo:20260618T100000\r\nDTEND;TZID=Asia/Tokyo:20260618T110000\r\nSUMMARY:1週間後\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:two-weeks-later\r\nDTSTART;TZID=Asia/Tokyo:20260625T100000\r\nDTEND;TZID=Asia/Tokyo:20260625T110000\r\nSUMMARY:2週間後\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;

    expect(parseCalendarEvents(fixture, { now: NOW, days: 14 }).map((event) => event.title)).toEqual([
      "1週間後",
    ]);
  });

  it("タイトルがない VEVENT は throw する", () => {
    const invalid = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:invalid\r\nDTSTART:20260611T000000Z\r\nDTEND:20260611T010000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    expect(() => parseCalendarEvents(invalid, { now: NOW })).toThrow("ICS event is missing a title");
  });

  it("パラメータ付き SUMMARY と DTEND 省略の終日予定を正規化する", () => {
    const fixture = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:parameterized\r\nDTSTART;VALUE=DATE:20260611\r\nSUMMARY;LANGUAGE=ja:パラメータ付き\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    expect(parseCalendarEvents(fixture, { now: NOW, days: 1 })).toEqual([
      {
        title: "パラメータ付き",
        start: "2026-06-11T00:00:00.000+09:00",
        end: "2026-06-12T00:00:00.000+09:00",
        allDay: true,
      },
    ]);
  });
});

describe("fetchCalendarEvents", () => {
  it("同じ URL の ICS を10分キャッシュする", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(FIXTURE));

    await fetchCalendarEvents({ icsUrls: ["https://calendar.example/private.ics?token=secret"], days: 1 }, NOW);
    await fetchCalendarEvents({ icsUrls: ["https://calendar.example/private.ics?token=secret"], days: 1 }, NOW);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("normalizeCalendarUrl", () => {
  it("https URL を許可する", () => {
    expect(normalizeCalendarUrl("https://calendar.example/private.ics")).toBe(
      "https://calendar.example/private.ics",
    );
  });

  it("https 以外を拒否する", () => {
    expect(() => normalizeCalendarUrl("http://calendar.example/private.ics")).toThrow("ICS URL must use https");
  });

  it("不正な URL を拒否する", () => {
    expect(() => normalizeCalendarUrl("not-a-url")).toThrow("Invalid ICS URL");
  });
});
