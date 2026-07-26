"use client";

import { useState, useTransition } from "react";
import { renameCalendar } from "@/lib/actions/calendars";

export function CalendarName({
  calendarId,
  initialName,
}: {
  calendarId: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [, startTransition] = useTransition();

  return (
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => {
        if (name.trim() && name !== initialName) {
          startTransition(() => {
            renameCalendar(calendarId, name.trim());
          });
        }
      }}
      className="w-full rounded-lg border border-transparent px-2 py-1 text-xl font-semibold text-zinc-900 hover:border-zinc-200 focus:border-zinc-900 focus:outline-none"
    />
  );
}
