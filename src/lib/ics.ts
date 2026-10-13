import { addDays } from "@/lib/shift-phases";
import { zonedToUtc } from "@/lib/timezone";

export type IcsItem = {
  id: string;
  label: string;
  target_date: string | null;
  start_time: string | null;
  notes: string | null;
};

const EVENT_MINUTES = 60;

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// RFC 5545 lines max out at 75 octets; continuation lines start with a space.
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compactDate = (dateKey: string) => dateKey.replace(/-/g, "");

function timedRange(dateKey: string, time: string) {
  const [h, m] = time.split(":").map(Number);
  const startMinutes = h * 60 + m;
  const endTotal = startMinutes + EVENT_MINUTES;
  const endDate = endTotal >= 1440 ? addDays(dateKey, 1) : dateKey;
  const endMinutes = endTotal % 1440;
  const stamp = (date: string, minutes: number) =>
    `${compactDate(date)}T${String(Math.floor(minutes / 60)).padStart(2, "0")}${String(
      minutes % 60
    ).padStart(2, "0")}00`;
  return {
    start: stamp(dateKey, startMinutes),
    end: stamp(endDate, endMinutes),
  };
}

const utcStamp = (date: Date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildIcs(
  calendarName: string,
  items: IcsItem[],
  timezone: string | null = null,
  now = new Date()
) {
  const dtstamp = utcStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tapd In//Project Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const item of items) {
    if (!item.target_date) continue;
    lines.push("BEGIN:VEVENT", `UID:${item.id}@tapdin.tech`, `DTSTAMP:${dtstamp}`);
    if (item.start_time && timezone) {
      // UTC so every calendar app places it correctly for the viewer.
      const start = zonedToUtc(item.target_date, item.start_time, timezone);
      const end = new Date(start.getTime() + EVENT_MINUTES * 60000);
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
    } else if (item.start_time) {
      // No time zone set: floating local time, the same clock time for
      // whoever imports it.
      const { start, end } = timedRange(item.target_date, item.start_time);
      lines.push(`DTSTART:${start}`, `DTEND:${end}`);
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${compactDate(item.target_date)}`,
        `DTEND;VALUE=DATE:${compactDate(addDays(item.target_date, 1))}`
      );
    }
    lines.push(`SUMMARY:${escapeText(item.label)}`);
    if (item.notes) lines.push(`DESCRIPTION:${escapeText(item.notes)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function icsResponse(
  calendarName: string,
  items: IcsItem[],
  timezone: string | null = null
) {
  const filename =
    calendarName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() ||
    "calendar";
  return new Response(buildIcs(calendarName, items, timezone), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
