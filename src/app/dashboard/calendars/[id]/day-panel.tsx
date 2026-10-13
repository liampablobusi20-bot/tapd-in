"use client";

import { useEffect } from "react";
import type { ShiftResult } from "@/lib/actions/calendar-items";
import { AddItemForm } from "@/components/add-item-form";
import { PhaseRow } from "./phase-row";
import { EntriesSection, type Group } from "./entries-section";
import { parseDateKey } from "@/lib/month-grid";
import type { Entry, Phase } from "./calendar-types";

export function DayPanel({
  dateKey,
  focusItemId = null,
  items,
  allPhases,
  entries,
  calendarId,
  groups,
  timezone,
  onShifted,
  onClose,
}: {
  dateKey: string | null;
  focusItemId?: string | null;
  items: Phase[];
  allPhases: Phase[];
  entries: Entry[];
  calendarId: string;
  groups: Group[];
  timezone: string | null;
  onShifted: (result: ShiftResult) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Focused on one item: follow that item's own date, which can change from
  // inside the panel. Otherwise the whole day (or the unscheduled list).
  const titleKey = focusItemId ? (items[0]?.target_date ?? null) : dateKey;
  const dateLabel = titleKey
    ? parseDateKey(titleKey).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "Unscheduled";
  const addDateKey = focusItemId ? null : dateKey;

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
                {addDateKey
                  ? "Nothing scheduled for this day yet."
                  : "This item is no longer here."}
              </p>
              {addDateKey && (
                <AddItemForm calendarId={calendarId} dateKey={addDateKey}>
                    + Add item for this day
                  </AddItemForm>
              )}
            </div>
          )}

          <div className="flex flex-col divide-y divide-zinc-100">
            {items.map((item) => (
              <div key={item.id}>
                <PhaseRow
                  phase={item}
                  calendarId={calendarId}
                  allPhases={allPhases}
                  onShifted={onShifted}
                  timezone={timezone}
                  groups={groups}
                />
                <EntriesSection
                  entries={entries.filter(
                    (e) => e.calendar_item_id === item.id
                  )}
                  calendarItemId={item.id}
                  calendarId={calendarId}
                  groups={groups}
                />
              </div>
            ))}
          </div>

          {items.length > 0 && addDateKey && (
            <div className="p-4">
              <AddItemForm calendarId={calendarId} dateKey={addDateKey}>
                + Add another item for this day
              </AddItemForm>
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
