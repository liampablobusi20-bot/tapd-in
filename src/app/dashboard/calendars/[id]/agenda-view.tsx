"use client";

import { useEffect, useMemo, useRef } from "react";
import { createItem } from "@/lib/actions/calendar-items";
import { PhaseStatusBadge } from "@/components/phase-status-badge";
import { ItemTime } from "@/components/item-time";
import { compareSchedule } from "@/lib/shift-phases";
import { parseDateKey } from "@/lib/month-grid";
import { restrictionLabel } from "@/lib/visibility-label";
import type { Group } from "./entries-section";
import type { Entry, Phase } from "./calendar-types";

export function AgendaView({
  calendarId,
  items,
  entries,
  todayKey,
  timezone,
  visibilityGroups,
  onOpenItem,
}: {
  calendarId: string;
  items: Phase[];
  entries: Entry[];
  todayKey: string;
  timezone: string | null;
  visibilityGroups: Group[];
  onOpenItem: (dateKey: string | null, itemId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { groups, unscheduled, scrollTargetKey } = useMemo(() => {
    const sorted = [...items].sort(compareSchedule);
    const byDate = new Map<string, Phase[]>();
    const undated: Phase[] = [];
    for (const item of sorted) {
      if (!item.target_date) {
        undated.push(item);
        continue;
      }
      const list = byDate.get(item.target_date) ?? [];
      list.push(item);
      byDate.set(item.target_date, list);
    }
    const dateKeys = [...byDate.keys()];
    return {
      groups: dateKeys.map((key) => ({ key, items: byDate.get(key)! })),
      unscheduled: undated,
      scrollTargetKey: dateKeys.find((key) => key >= todayKey) ?? null,
    };
  }, [items, todayKey]);

  // Start the list at today (or the next scheduled day) instead of the top.
  useEffect(() => {
    const container = scrollRef.current;
    const target = container?.querySelector<HTMLElement>("[data-scroll-target]");
    if (container && target) container.scrollTop = target.offsetTop;
  }, [scrollTargetKey]);

  function row(item: Phase, dateKey: string | null) {
    const noteCount = entries.filter((e) => e.calendar_item_id === item.id).length;
    return (
      <li key={item.id}>
        <button
          onClick={() => onOpenItem(dateKey, item.id)}
          className="flex w-full items-start gap-4 px-5 py-3 text-left hover:bg-zinc-50"
        >
          <div className="w-28 flex-shrink-0 pt-0.5 text-sm text-zinc-600">
            {dateKey && item.start_time ? (
              <ItemTime dateKey={dateKey} time={item.start_time} timezone={timezone} />
            ) : (
              <span className="text-zinc-400">{dateKey ? "All day" : "No date"}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-zinc-900">{item.label}</span>
              <PhaseStatusBadge status={item.status} />
              {item.visible_group_ids && (
                <span className="text-xs font-medium text-amber-700">
                  Only {restrictionLabel(item.visible_group_ids, visibilityGroups)}
                </span>
              )}
            </div>
            {item.notes && (
              <p className="mt-0.5 truncate text-sm text-zinc-500">{item.notes}</p>
            )}
          </div>
          {noteCount > 0 && (
            <span className="flex-shrink-0 pt-0.5 text-xs text-zinc-400">
              {noteCount} {noteCount === 1 ? "note" : "notes"}
            </span>
          )}
        </button>
      </li>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div ref={scrollRef} className="relative max-h-[70vh] overflow-y-auto">
        {groups.length === 0 && unscheduled.length === 0 && (
          <p className="px-5 py-10 text-center text-sm text-zinc-500">
            Nothing on this calendar yet.
          </p>
        )}

        {groups.map((group) => {
          const isToday = group.key === todayKey;
          return (
            <section
              key={group.key}
              {...(group.key === scrollTargetKey ? { "data-scroll-target": "" } : {})}
            >
              <h4
                className={`sticky top-0 z-10 flex items-center gap-2 border-b border-zinc-100 px-5 py-2 text-xs font-semibold uppercase tracking-wide ${
                  isToday ? "bg-zinc-900 text-white" : "bg-zinc-50 text-zinc-500"
                }`}
              >
                {parseDateKey(group.key).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {isToday && <span className="font-medium normal-case">· Today</span>}
              </h4>
              <ul className="divide-y divide-zinc-100">
                {group.items.map((item) => row(item, group.key))}
              </ul>
            </section>
          );
        })}

        {unscheduled.length > 0 && (
          <section>
            <h4 className="sticky top-0 z-10 border-b border-zinc-100 bg-zinc-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Unscheduled
            </h4>
            <ul className="divide-y divide-zinc-100">
              {unscheduled.map((item) => row(item, null))}
            </ul>
          </section>
        )}
      </div>
      <div className="border-t border-zinc-100 p-4">
        <form action={createItem.bind(null, calendarId, null)}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-400"
          >
            + Add item
          </button>
        </form>
      </div>
    </div>
  );
}
