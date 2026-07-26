"use client";

import { useTransition } from "react";
import { deleteCalendar } from "@/lib/actions/calendars";

export function DeleteCalendarButton({ calendarId }: { calendarId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => deleteCalendar(calendarId))}
      disabled={pending}
      className="text-sm font-medium text-zinc-400 hover:text-red-600 disabled:opacity-50"
    >
      Delete calendar
    </button>
  );
}
