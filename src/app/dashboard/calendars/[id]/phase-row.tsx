"use client";

import { useState, useTransition } from "react";
import {
  updateItem,
  deleteItem,
  shiftPhasesFrom,
  type PhaseStatus,
  type ShiftResult,
} from "@/lib/actions/calendar-items";
import { isValidShiftDays, selectPhasesToShift } from "@/lib/shift-phases";
import { zoneAbbreviation } from "@/lib/timezone";
import type { Group } from "./entries-section";
import { RelativeTime } from "@/components/relative-time";
import { PhaseStatusSelect } from "@/components/phase-status-badge";

type Phase = {
  id: string;
  label: string;
  target_date: string | null;
  start_time: string | null;
  notes: string | null;
  status: PhaseStatus;
  sort_order: number;
  visible_group_ids: string[] | null;
  updated_at: string;
};

export function PhaseRow({
  phase,
  calendarId,
  allPhases,
  onShifted,
  timezone = null,
  groups = [],
}: {
  phase: Phase;
  calendarId: string;
  allPhases?: Phase[];
  onShifted?: (result: ShiftResult) => void;
  timezone?: string | null;
  groups?: Group[];
}) {
  const [label, setLabel] = useState(phase.label);
  const [date, setDate] = useState(phase.target_date ?? "");
  const [time, setTime] = useState((phase.start_time ?? "").slice(0, 5));
  const [notes, setNotes] = useState(phase.notes ?? "");
  const [isRemoving, startRemoveTransition] = useTransition();
  const [, startTransition] = useTransition();
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftDays, setShiftDays] = useState("");
  const [shiftError, setShiftError] = useState<string | null>(null);
  const [shifting, startShift] = useTransition();

  const groupIds = new Set(groups.map((group) => group.id));
  const restrictedTo = (phase.visible_group_ids ?? []).filter((id) => groupIds.has(id));
  const hasDeletedGroup = (phase.visible_group_ids ?? []).some((id) => !groupIds.has(id));

  // Saves exactly the groups ticked now (ids of deleted groups are dropped);
  // nothing ticked means everyone can see it.
  function saveVisibility(next: string[]) {
    startTransition(async () => {
      await updateItem(phase.id, calendarId, {
        visible_group_ids: next.length ? next : null,
      });
    });
  }

  function toggleGroup(groupId: string) {
    saveVisibility(
      restrictedTo.includes(groupId)
        ? restrictedTo.filter((id) => id !== groupId)
        : [...restrictedTo, groupId]
    );
  }

  const canShift = Boolean(phase.target_date && allPhases && onShifted);
  const shiftCount = canShift ? selectPhasesToShift(phase, allPhases!).length : 0;
  const parsedShiftDays = Number(shiftDays);
  const shiftValid = shiftDays.trim() !== "" && isValidShiftDays(parsedShiftDays);

  function submitShift() {
    if (!shiftValid || !onShifted) return;
    setShiftError(null);
    startShift(async () => {
      try {
        const result = await shiftPhasesFrom(phase.id, calendarId, parsedShiftDays);
        onShifted(result);
      } catch {
        setShiftError("Couldn't shift the schedule. Try again.");
      }
    });
  }

  function saveLabel() {
    if (label.trim() && label !== phase.label) {
      startTransition(async () => {
        await updateItem(phase.id, calendarId, { label: label.trim() });
      });
    }
  }

  function saveDate(value: string) {
    setDate(value);
    startTransition(async () => {
      await updateItem(phase.id, calendarId, { target_date: value || null });
    });
  }

  function saveTime(value: string) {
    setTime(value);
    startTransition(async () => {
      await updateItem(phase.id, calendarId, { start_time: value || null });
    });
  }

  function saveNotes() {
    if (notes !== (phase.notes ?? "")) {
      startTransition(async () => {
        await updateItem(phase.id, calendarId, { notes });
      });
    }
  }

  function saveStatus(status: PhaseStatus) {
    startTransition(async () => {
      await updateItem(phase.id, calendarId, { status });
    });
  }

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveLabel}
          placeholder="Item name"
          className="min-w-0 flex-1 rounded-lg border border-transparent px-1.5 py-1 text-base font-semibold text-zinc-900 hover:border-zinc-200 focus:border-zinc-900 focus:outline-none"
        />
        <button
          onClick={() =>
            startRemoveTransition(async () => {
              await deleteItem(phase.id, calendarId);
            })
          }
          disabled={isRemoving}
          className="flex-shrink-0 rounded-md px-1.5 py-1 text-xs font-medium text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          {isRemoving ? "Removing…" : "Remove"}
        </button>
      </div>

      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1.5">
        <input
          type="date"
          value={date}
          onChange={(e) => saveDate(e.target.value)}
          className="rounded-md border border-transparent py-0.5 text-sm text-zinc-600 hover:border-zinc-200 focus:border-zinc-900 focus:outline-none"
        />
        {date && (
          <input
            type="time"
            value={time}
            onChange={(e) => saveTime(e.target.value)}
            aria-label="Start time"
            className="rounded-md border border-transparent py-0.5 text-sm text-zinc-600 hover:border-zinc-200 focus:border-zinc-900 focus:outline-none"
          />
        )}
        {date && time && timezone && (
          <span className="text-xs text-zinc-400" title={timezone}>
            {zoneAbbreviation(date, timezone)}
          </span>
        )}
        <PhaseStatusSelect status={phase.status} onChange={saveStatus} />
        <span className="text-xs text-zinc-400">
          Updated <RelativeTime date={phase.updated_at} />
        </span>
        {canShift && !shiftOpen && (
          <button
            type="button"
            onClick={() => setShiftOpen(true)}
            className="text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
          >
            Shift schedule…
          </button>
        )}
      </div>

      {canShift && shiftOpen && (
        <div className="mx-1.5 mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs text-zinc-600">
            Push this item and everything scheduled after it by:
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              step={1}
              min={-365}
              max={365}
              value={shiftDays}
              onChange={(e) => setShiftDays(e.target.value)}
              placeholder="3"
              aria-label="Days to shift"
              className="w-20 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none"
            />
            <span className="text-sm text-zinc-600">days</span>
            <button
              type="button"
              onClick={submitShift}
              disabled={!shiftValid || shifting}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
            >
              {shifting
                ? "Shifting…"
                : `Shift ${shiftCount} ${shiftCount === 1 ? "item" : "items"}`}
            </button>
            <button
              type="button"
              onClick={() => {
                setShiftOpen(false);
                setShiftDays("");
                setShiftError(null);
              }}
              disabled={shifting}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            Use a negative number to move things earlier. Items without a date
            don&apos;t move, and you can undo right after.
          </p>
          {shiftError && <p className="mt-1 text-xs text-red-600">{shiftError}</p>}
        </div>
      )}

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={saveNotes}
        placeholder="Notes"
        className="mt-1.5 w-full rounded-lg border border-transparent px-1.5 py-1 text-sm text-zinc-600 hover:border-zinc-200 focus:border-zinc-900 focus:outline-none"
      />

      {groups.length > 0 && (
        <fieldset className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1.5 text-xs">
          <legend className="sr-only">Who can see this item</legend>
          <span className="text-zinc-500">Only share this item with (none = everyone):</span>
          {groups.map((group) => (
            <label key={group.id} className="cursor-pointer">
              <input
                type="checkbox"
                checked={restrictedTo.includes(group.id)}
                onChange={() => toggleGroup(group.id)}
                className="peer sr-only"
              />
              <span className="inline-block rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 font-medium text-zinc-600 peer-checked:border-zinc-900 peer-checked:bg-zinc-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-900/20">
                {group.name}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {hasDeletedGroup && (
        <p className="mt-1 px-1.5 text-xs font-medium text-amber-700">
          This item was limited to a group that no longer exists, so only you can see it.{" "}
          <button
            type="button"
            onClick={() => saveVisibility([])}
            className="underline underline-offset-2 hover:text-amber-900"
          >
            Make it visible to everyone
          </button>
        </p>
      )}
    </div>
  );
}
