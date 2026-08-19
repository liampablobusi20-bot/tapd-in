"use client";

import { useState, useTransition } from "react";
import { deleteCalendar } from "@/lib/actions/calendars";

export function DeleteCalendarButton({
  calendarId,
  calendarName,
}: {
  calendarId: string;
  calendarName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-zinc-400 hover:text-red-600"
      >
        Delete calendar
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 px-4"
          onClick={() => !pending && setConfirming(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-zinc-900">
              Delete &ldquo;{calendarName}&rdquo;?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">
              This permanently deletes the calendar, every phase, photo,
              comment, and invite link on it. This can&apos;t be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  startTransition(async () => await deleteCalendar(calendarId))
                }
                disabled={pending}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
