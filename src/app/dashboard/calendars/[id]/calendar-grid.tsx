"use client";

import { useMemo, useState } from "react";
import { getMonthGrid, toDateKey } from "@/lib/month-grid";
import { createItem } from "@/lib/actions/calendar-items";
import { DayPanel } from "./day-panel";
import { PhaseRow } from "./phase-row";
import { EntriesSection } from "./entries-section";

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

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarGrid({
  calendarId,
  items,
  entries,
}: {
  calendarId: string;
  items: Phase[];
  entries: Entry[];
}) {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  const [cursor, setCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, Phase[]>();
    for (const item of items) {
      if (!item.target_date) continue;
      const list = map.get(item.target_date) ?? [];
      list.push(item);
      map.set(item.target_date, list);
    }
    return map;
  }, [items]);

  const unscheduled = items.filter((item) => !item.target_date);
  const cells = useMemo(
    () => getMonthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor]
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">
          {cursor.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth(), 1))
            }
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 shadow-sm hover:border-zinc-400"
          >
            Today
          </button>
          <button
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)
              )
            }
            aria-label="Previous month"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 shadow-sm hover:border-zinc-400"
          >
            ‹
          </button>
          <button
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
              )
            }
            aria-label="Next month"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 shadow-sm hover:border-zinc-400"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 shadow-sm gap-px">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-zinc-50 px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-500"
          >
            {label}
          </div>
        ))}
        {cells.map((cell) => {
          const key = toDateKey(cell.date);
          const dayItems = itemsByDate.get(key) ?? [];
          const isToday = key === todayKey;
          const visible = dayItems.slice(0, 2);
          const overflow = dayItems.length - visible.length;

          return (
            <button
              key={key}
              onClick={() => setSelectedKey(key)}
              className={`flex min-h-20 flex-col items-start gap-1 bg-white p-1.5 text-left transition-colors hover:bg-zinc-50 sm:min-h-24 sm:p-2 ${
                cell.inCurrentMonth ? "" : "bg-zinc-50/50"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday
                    ? "bg-zinc-900 font-semibold text-white"
                    : cell.inCurrentMonth
                      ? "text-zinc-700"
                      : "text-zinc-400"
                }`}
              >
                {cell.date.getDate()}
              </span>
              <div className="flex w-full flex-col gap-0.5">
                {visible.map((item) => (
                  <span
                    key={item.id}
                    className="truncate rounded bg-zinc-100 px-1 py-0.5 text-[11px] leading-tight text-zinc-700"
                  >
                    {item.label}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="px-1 text-[11px] text-zinc-500">
                    +{overflow} more
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Unscheduled</h3>
          <form action={createItem.bind(null, calendarId, null)}>
            <button
              type="submit"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              + Add phase
            </button>
          </form>
        </div>

        {unscheduled.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Nothing unscheduled — every phase has a date.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {unscheduled.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
              >
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
        )}
      </div>

      {selectedKey && (
        <DayPanel
          dateKey={selectedKey}
          items={itemsByDate.get(selectedKey) ?? []}
          entries={entries}
          calendarId={calendarId}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </div>
  );
}
