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
import { Spinner } from "@/components/pending-button";
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
  const [shiftReason, setShiftReason] = useState("");
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
        const result = await shiftPhasesFrom(
          phase.id,
          calendarId,
          parsedShiftDays,
          shiftReason
        );
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

  const chip =
    "inline-block cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-medium";
  const chipOn = "border-zinc-900 bg-zinc-900 text-white";
  const chipOff = "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400";

  return (
    <div className="p-4">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={saveLabel}
        placeholder="Item name"
        className="w-full rounded-lg border border-transparent px-1.5 py-1 text-base font-semibold text-zinc-900 hover:border-zinc-200 focus:border-zinc-900 focus:outline-none"
      />

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
      </div>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={saveNotes}
        placeholder="Notes"
        className="mt-1.5 w-full rounded-lg border border-transparent px-1.5 py-1 text-sm text-zinc-600 hover:border-zinc-200 focus:border-zinc-900 focus:outline-none"
      />

      {groups.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1.5">
          <span className="text-xs font-medium text-zinc-600">Who can see this item:</span>
          <button
            type="button"
            onClick={() => saveVisibility([])}
            className={`${chip} ${restrictedTo.length === 0 && !hasDeletedGroup ? chipOn : chipOff}`}
          >
            Everyone
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-pressed={restrictedTo.includes(group.id)}
              className={`${chip} ${restrictedTo.includes(group.id) ? chipOn : chipOff}`}
            >
              {group.name}
            </button>
          ))}
        </div>
      )}
      {groups.length === 0 && (
        <p className="mt-1.5 px-1.5 text-xs text-zinc-400">
          Everyone invited can see this item. To limit it to certain people, create a group under
          Invite people.
        </p>
      )}
      {hasDeletedGroup && (
        <p className="mt-1 px-1.5 text-xs font-medium text-amber-700">
          Limited to a deleted group, so only you can see this.{" "}
          <button
            type="button"
            onClick={() => saveVisibility([])}
            className="underline underline-offset-2 hover:text-amber-900"
          >
            Show to everyone
          </button>
        </p>
      )}

      <details className="group mt-1 px-1.5">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-700 [&::-webkit-details-marker]:hidden">
          <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3 transition-transform group-open:rotate-90" aria-hidden>
            <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          More
        </summary>

        <div className="mt-2 flex flex-col gap-3 rounded-xl bg-zinc-50 p-3">
          {canShift && !shiftOpen && (
            <button
              type="button"
              onClick={() => setShiftOpen(true)}
              className="self-start text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
            >
              Shift schedule…
            </button>
          )}
          {canShift && shiftOpen && (
            <div className="rounded-lg border border-zinc-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-zinc-600">Move this and everything after it</span>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={-365}
                  max={365}
                  value={shiftDays}
                  onChange={(e) => setShiftDays(e.target.value)}
                  placeholder="3"
                  aria-label="Days to shift (negative moves earlier)"
                  className="w-16 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none"
                />
                <span className="text-sm text-zinc-600">days</span>
              </div>
              <input
                value={shiftReason}
                onChange={(e) => setShiftReason(e.target.value)}
                maxLength={200}
                placeholder="Reason (optional)"
                aria-label="Reason for the change"
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={submitShift}
                  disabled={!shiftValid || shifting}
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
                >
                  {shifting && <Spinner />}
                  {shifting
                    ? "Shifting…"
                    : `Shift ${shiftCount} ${shiftCount === 1 ? "item" : "items"}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShiftOpen(false);
                    setShiftDays("");
                    setShiftReason("");
                    setShiftError(null);
                  }}
                  disabled={shifting}
                  className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              {shiftError && <p className="mt-1 text-xs text-red-600">{shiftError}</p>}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              Updated <RelativeTime date={phase.updated_at} />
            </span>
            <button
              onClick={() =>
                startRemoveTransition(async () => {
                  await deleteItem(phase.id, calendarId);
                })
              }
              disabled={isRemoving}
              className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              {isRemoving && <Spinner className="h-3 w-3" />}
              {isRemoving ? "Removing…" : "Remove item"}
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
