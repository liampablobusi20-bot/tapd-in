"use client";

import { createItem } from "@/lib/actions/calendar-items";
import { PhaseStatusBadge } from "@/components/phase-status-badge";
import { ItemTime } from "@/components/item-time";
import { restrictionLabel } from "@/lib/visibility-label";
import type { Group } from "./entries-section";
import type { Entry, Phase } from "./calendar-types";

export function DayView({
  calendarId,
  dateKey,
  items,
  entries,
  timezone,
  groups,
  onOpenItem,
}: {
  calendarId: string;
  dateKey: string;
  items: Phase[];
  entries: Entry[];
  timezone: string | null;
  groups: Group[];
  onOpenItem: (itemId: string) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-zinc-500">
          Nothing scheduled for this day.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {items.map((item) => {
            const noteCount = entries.filter(
              (e) => e.calendar_item_id === item.id
            ).length;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onOpenItem(item.id)}
                  className="flex w-full items-start gap-4 px-5 py-4 text-left hover:bg-zinc-50"
                >
                  <div className="w-28 flex-shrink-0 text-sm text-zinc-600">
                    {item.start_time ? (
                      <ItemTime
                        dateKey={dateKey}
                        time={item.start_time}
                        timezone={timezone}
                      />
                    ) : (
                      <span className="text-zinc-400">All day</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-zinc-900">
                        {item.label}
                      </span>
                      <PhaseStatusBadge status={item.status} />
                      {item.visible_group_ids && (
                        <span className="text-xs font-medium text-amber-700">
                          Only {restrictionLabel(item.visible_group_ids, groups)}
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="mt-1 text-sm text-zinc-600">{item.notes}</p>
                    )}
                    {noteCount > 0 && (
                      <p className="mt-1 text-xs text-zinc-400">
                        {noteCount} {noteCount === 1 ? "note" : "notes"}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t border-zinc-100 p-4">
        <form action={createItem.bind(null, calendarId, dateKey)}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-400"
          >
            + Add item for this day
          </button>
        </form>
      </div>
    </div>
  );
}
