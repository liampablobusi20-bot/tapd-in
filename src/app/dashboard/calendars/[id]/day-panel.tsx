"use client";

import { useEffect } from "react";
import { createItem } from "@/lib/actions/calendar-items";
import { PhaseRow } from "./phase-row";
import { EntriesSection } from "./entries-section";
import { parseDateKey } from "@/lib/month-grid";

type Phase = {
  id: string;
  label: string;
  target_date: string | null;
  notes: string | null;
  updated_at: string;
};

type Entry = {
  id: string;
  calendar_item_id: string;
  author_label: string | null;
  body_text: string | null;
  photo_url: string | null;
  media_type: string | null;
  created_at: string;
};

export function DayPanel({
  dateKey,
  items,
  entries,
  calendarId,
  onClose,
}: {
  dateKey: string;
  items: Phase[];
  entries: Entry[];
  calendarId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const dateLabel = parseDateKey(dateKey).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h3 className="text-base font-semibold text-zinc-900">
            {dateLabel}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 && (
            <div className="p-5">
              <p className="mb-3 text-sm text-zinc-500">
                Nothing scheduled for this day yet.
              </p>
              <form action={createItem.bind(null, calendarId, dateKey)}>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-400"
                >
                  + Add phase for this day
                </button>
              </form>
            </div>
          )}

          <div className="flex flex-col divide-y divide-zinc-100">
            {items.map((item) => (
              <div key={item.id}>
                <PhaseRow phase={item} calendarId={calendarId} />
                <EntriesSection
                  entries={entries.filter(
                    (e) => e.calendar_item_id === item.id
                  )}
                  calendarItemId={item.id}
                  calendarId={calendarId}
                />
              </div>
            ))}
          </div>

          {items.length > 0 && (
            <div className="p-4">
              <form action={createItem.bind(null, calendarId, dateKey)}>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-400"
                >
                  + Add another phase for this day
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-100 p-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
