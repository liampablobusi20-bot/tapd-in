"use client";

import { useState, useTransition } from "react";
import { updateCalendarTimezone } from "@/lib/actions/calendars";
import { COMMON_TIME_ZONES } from "@/lib/timezone";

export function CalendarTimezone({
  calendarId,
  timezone,
}: {
  calendarId: string;
  timezone: string | null;
}) {
  const [value, setValue] = useState(timezone ?? "");
  const [pending, startTransition] = useTransition();
  const known = COMMON_TIME_ZONES.some((zone) => zone.value === value);

  return (
    <label className="mt-1 flex items-center gap-2 px-2 text-sm text-zinc-500">
      Time zone
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          startTransition(async () => {
            await updateCalendarTimezone(calendarId, next || null);
          });
        }}
        className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-700 hover:border-zinc-300 focus:border-zinc-900 focus:outline-none disabled:opacity-50"
      >
        <option value="">Not set</option>
        {value && !known && <option value={value}>{value}</option>}
        {COMMON_TIME_ZONES.map((zone) => (
          <option key={zone.value} value={zone.value}>
            {zone.label}
          </option>
        ))}
      </select>
    </label>
  );
}
