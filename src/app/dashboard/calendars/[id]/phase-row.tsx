"use client";

import { useState, useTransition } from "react";
import { updateItem, deleteItem } from "@/lib/actions/calendar-items";
import { RelativeTime } from "@/components/relative-time";

type Phase = {
  id: string;
  label: string;
  target_date: string | null;
  notes: string | null;
  updated_at: string;
};

export function PhaseRow({
  phase,
  calendarId,
}: {
  phase: Phase;
  calendarId: string;
}) {
  const [label, setLabel] = useState(phase.label);
  const [date, setDate] = useState(phase.target_date ?? "");
  const [notes, setNotes] = useState(phase.notes ?? "");
  const [isRemoving, startRemoveTransition] = useTransition();
  const [, startTransition] = useTransition();

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

  function saveNotes() {
    if (notes !== (phase.notes ?? "")) {
      startTransition(async () => {
        await updateItem(phase.id, calendarId, { notes });
      });
    }
  }

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={saveLabel}
          placeholder="Phase label"
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
        <span className="text-xs text-zinc-400">
          Updated <RelativeTime date={phase.updated_at} />
        </span>
      </div>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={saveNotes}
        placeholder="Notes"
        className="mt-1.5 w-full rounded-lg border border-transparent px-1.5 py-1 text-sm text-zinc-600 hover:border-zinc-200 focus:border-zinc-900 focus:outline-none"
      />
    </div>
  );
}
