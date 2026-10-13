"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getMonthGrid, toDateKey } from "@/lib/month-grid";
import { compareSchedule } from "@/lib/shift-phases";
import { formatTime } from "@/lib/format-time";
import { AddItemForm, ADD_LINK_CLASS } from "@/components/add-item-form";
import {
  shiftPhasesByIds,
  type ShiftResult,
} from "@/lib/actions/calendar-items";
import { STATUS_COLORS, PhaseStatusBadge } from "@/components/phase-status-badge";
import { DayPanel } from "./day-panel";
import type { Group } from "./entries-section";
import { WeekView } from "./week-view";
import { DayView } from "./day-view";
import { AgendaView } from "./agenda-view";
import type { Entry, Phase } from "./calendar-types";

type View = "month" | "week" | "day" | "list";

const VIEWS: { id: View; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
  { id: "list", label: "List" },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const addDaysLocal = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export function CalendarGrid({
  calendarId,
  items,
  entries,
  groups,
  timezone,
}: {
  calendarId: string;
  items: Phase[];
  entries: Entry[];
  groups: Group[];
  timezone: string | null;
}) {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  const [view, setView] = useState<View>("month");
  const [focus, setFocus] = useState(today);
  const [panel, setPanel] = useState<{
    dateKey: string | null;
    focusItemId: string | null;
  } | null>(null);
  const [shiftToast, setShiftToast] = useState<ShiftResult | null>(null);
  const [undoFailed, setUndoFailed] = useState(false);
  const [undoing, startUndo] = useTransition();

  useEffect(() => {
    if (!shiftToast) return;
    const timer = setTimeout(() => setShiftToast(null), 20000);
    return () => clearTimeout(timer);
  }, [shiftToast]);

  function handleShifted(result: ShiftResult) {
    setUndoFailed(false);
    setShiftToast(result);
    setPanel(null);
  }

  function undoShift() {
    if (!shiftToast) return;
    const { movedIds, days } = shiftToast;
    startUndo(async () => {
      try {
        await shiftPhasesByIds(calendarId, movedIds, -days, "Undo");
        setShiftToast(null);
      } catch {
        setUndoFailed(true);
      }
    });
  }

  const itemsByDate = useMemo(() => {
    const map = new Map<string, Phase[]>();
    for (const item of items) {
      if (!item.target_date) continue;
      const list = map.get(item.target_date) ?? [];
      list.push(item);
      map.set(item.target_date, list);
    }
    for (const list of map.values()) list.sort(compareSchedule);
    return map;
  }, [items]);

  const unscheduled = items.filter((item) => !item.target_date);
  const cells = useMemo(
    () => getMonthGrid(focus.getFullYear(), focus.getMonth()),
    [focus]
  );

  const focusKey = toDateKey(focus);
  const weekStart = addDaysLocal(focus, -focus.getDay());

  function step(direction: -1 | 1) {
    if (view === "month") {
      setFocus(new Date(focus.getFullYear(), focus.getMonth() + direction, 1));
    } else if (view === "week") {
      setFocus(addDaysLocal(focus, 7 * direction));
    } else if (view === "day") {
      setFocus(addDaysLocal(focus, direction));
    }
  }

  let title = "All items";
  if (view === "month") {
    title = focus.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } else if (view === "week") {
    const weekEnd = addDaysLocal(weekStart, 6);
    title = `${weekStart.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })} – ${weekEnd.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  } else if (view === "day") {
    title = focus.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const panelItems = panel
    ? panel.focusItemId
      ? items.filter((item) => item.id === panel.focusItemId)
      : panel.dateKey
        ? (itemsByDate.get(panel.dateKey) ?? [])
        : unscheduled
    : [];

  const openDay = (dateKey: string) => setPanel({ dateKey, focusItemId: null });
  const openItem = (dateKey: string | null, itemId: string) =>
    setPanel({ dateKey, focusItemId: itemId });

  const navButton =
    "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-600 shadow-sm hover:border-zinc-400";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div
            data-tour="views"
            role="tablist"
            aria-label="Calendar view"
            className="flex overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
          >
            {VIEWS.map((option) => (
              <button
                key={option.id}
                role="tab"
                aria-selected={view === option.id}
                onClick={() => setView(option.id)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  view === option.id
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {view !== "list" && (
            <div className="flex items-center gap-1">
              <button onClick={() => setFocus(new Date(today))} className={`${navButton} font-medium`}>
                Today
              </button>
              <button onClick={() => step(-1)} aria-label="Previous" className={navButton}>
                ‹
              </button>
              <button onClick={() => step(1)} aria-label="Next" className={navButton}>
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {view === "month" && (
        <div
          data-tour="grid"
          className="mt-4 grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 shadow-sm"
        >
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
                onClick={() => openDay(key)}
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
                      className={`truncate rounded px-1 py-0.5 text-[11px] leading-tight ${STATUS_COLORS[item.status]}`}
                    >
                      {item.start_time && (
                        <span className="mr-1 hidden font-medium sm:inline">
                          {formatTime(item.start_time)}
                        </span>
                      )}
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
      )}

      {view === "week" && (
        <WeekView
          weekStart={weekStart}
          itemsByDate={itemsByDate}
          todayKey={todayKey}
          timezone={timezone}
          onOpenDay={openDay}
          onOpenItem={openItem}
        />
      )}

      {view === "day" && (
        <DayView
          calendarId={calendarId}
          dateKey={focusKey}
          items={itemsByDate.get(focusKey) ?? []}
          entries={entries}
          timezone={timezone}
          groups={groups}
          onOpenItem={(itemId) => openItem(focusKey, itemId)}
        />
      )}

      {view === "list" && (
        <AgendaView
          calendarId={calendarId}
          items={items}
          entries={entries}
          todayKey={todayKey}
          timezone={timezone}
          visibilityGroups={groups}
          onOpenItem={openItem}
        />
      )}

      {view !== "list" && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">Unscheduled</h3>
            <AddItemForm calendarId={calendarId} className={ADD_LINK_CLASS}>
                + Add item
              </AddItemForm>
          </div>

          {unscheduled.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              Nothing unscheduled — every item has a date.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {unscheduled.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => openItem(null, item.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm hover:border-zinc-300"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium text-zinc-900">{item.label}</span>
                      <PhaseStatusBadge status={item.status} />
                    </span>
                    <span className="flex-shrink-0 text-xs text-zinc-400">Set a date</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {panel && (
        <DayPanel
          dateKey={panel.dateKey}
          focusItemId={panel.focusItemId}
          items={panelItems}
          allPhases={items}
          entries={entries}
          calendarId={calendarId}
          groups={groups}
          timezone={timezone}
          onShifted={handleShifted}
          onClose={() => setPanel(null)}
        />
      )}

      {shiftToast && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4"
        >
          <div className="flex items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg">
            <span>
              {undoFailed
                ? "Couldn't undo — adjust the dates by hand."
                : `Moved ${shiftToast.movedIds.length} ${
                    shiftToast.movedIds.length === 1 ? "item" : "items"
                  } ${shiftToast.days > 0 ? "later" : "earlier"} by ${Math.abs(
                    shiftToast.days
                  )} ${Math.abs(shiftToast.days) === 1 ? "day" : "days"}.`}
            </span>
            {!undoFailed && (
              <button
                onClick={undoShift}
                disabled={undoing}
                className="font-semibold underline underline-offset-2 disabled:opacity-50"
              >
                {undoing ? "Undoing…" : "Undo"}
              </button>
            )}
            <button
              onClick={() => setShiftToast(null)}
              aria-label="Dismiss"
              className="text-zinc-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
