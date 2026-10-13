export const COMMON_TIME_ZONES: { value: string; label: string }[] = [
  { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
  { value: "America/Anchorage", label: "Alaska (Anchorage)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Phoenix", label: "Arizona (Phoenix)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Halifax", label: "Atlantic (Halifax)" },
  { value: "America/Mexico_City", label: "Mexico City" },
  { value: "America/Bogota", label: "Bogotá" },
  { value: "America/Sao_Paulo", label: "São Paulo" },
  { value: "Atlantic/Reykjavik", label: "Reykjavík" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Dublin", label: "Dublin" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Madrid", label: "Madrid" },
  { value: "Europe/Rome", label: "Rome" },
  { value: "Europe/Amsterdam", label: "Amsterdam" },
  { value: "Europe/Athens", label: "Athens" },
  { value: "Europe/Istanbul", label: "Istanbul" },
  { value: "Europe/Moscow", label: "Moscow" },
  { value: "Africa/Cairo", label: "Cairo" },
  { value: "Africa/Johannesburg", label: "Johannesburg" },
  { value: "Africa/Lagos", label: "Lagos" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Karachi", label: "Karachi" },
  { value: "Asia/Kolkata", label: "India (Kolkata)" },
  { value: "Asia/Dhaka", label: "Dhaka" },
  { value: "Asia/Bangkok", label: "Bangkok" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Hong_Kong", label: "Hong Kong" },
  { value: "Asia/Shanghai", label: "China (Shanghai)" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Seoul", label: "Seoul" },
  { value: "Australia/Perth", label: "Perth" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
];

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function offsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

// The instant at which the wall clock in `timeZone` reads dateKey + time.
// Refined twice so it lands correctly across a daylight-saving change.
export function zonedToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let utc = wall - offsetMinutes(timeZone, new Date(wall)) * 60000;
  utc = wall - offsetMinutes(timeZone, new Date(utc)) * 60000;
  return new Date(utc);
}

// "MST", "EDT", "GMT+1" — the zone's short name on that date.
export function zoneAbbreviation(dateKey: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(new Date(`${dateKey}T12:00:00Z`));
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

export function formatInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(instant);
}

// How an item's time reads for someone in `viewerZone`, or null when that
// matches what the calendar's own zone shows (same wall clock and date).
export function viewerLocalTime(
  dateKey: string,
  time: string,
  calendarZone: string,
  viewerZone: string
): string | null {
  const instant = zonedToUtc(dateKey, time, calendarZone);
  const wallClock = (zone: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(instant);
  if (wallClock(calendarZone) === wallClock(viewerZone)) return null;

  const dayOf = (zone: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(instant);
  const timeText = formatInZone(instant, viewerZone);
  if (dayOf(calendarZone) === dayOf(viewerZone)) return timeText;
  const dayText = new Intl.DateTimeFormat("en-US", {
    timeZone: viewerZone,
    month: "short",
    day: "numeric",
  }).format(instant);
  return `${dayText}, ${timeText}`;
}
