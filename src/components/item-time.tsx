"use client";

import { useSyncExternalStore } from "react";
import { formatTime } from "@/lib/format-time";
import {
  formatInZone,
  viewerLocalTime,
  zonedToUtc,
} from "@/lib/timezone";

const subscribe = () => () => {};
const viewerZoneNow = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const viewerZoneServer = () => null;

// The item's time in the calendar's time zone, plus the viewer's own clock
// when it differs. The viewer's zone is only known in the browser, so the
// server render shows the calendar-zone time alone.
export function ItemTime({
  dateKey,
  time,
  timezone,
  className,
  showLocal = true,
}: {
  dateKey: string;
  time: string | null;
  timezone: string | null;
  className?: string;
  showLocal?: boolean;
}) {
  const viewerZone = useSyncExternalStore(subscribe, viewerZoneNow, viewerZoneServer);
  if (!time) return null;
  if (!timezone) return <span className={className}>{formatTime(time)}</span>;

  const calendarText = formatInZone(zonedToUtc(dateKey, time, timezone), timezone);
  const local = showLocal && viewerZone
    ? viewerLocalTime(dateKey, time, timezone, viewerZone)
    : null;

  return (
    <span className={className}>
      {calendarText}
      {local && <span className="text-zinc-400"> ({local} your time)</span>}
    </span>
  );
}
