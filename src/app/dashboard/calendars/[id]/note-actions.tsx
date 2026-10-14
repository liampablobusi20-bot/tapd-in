"use client";

import { useState, useTransition } from "react";
import { deleteEntry, updateEntry } from "@/lib/actions/entries";
import { Spinner } from "@/components/pending-button";
import type { Group } from "./entries-section";

type NoteForActions = {
  id: string;
  author_type: "owner" | "guest";
  body_text: string | null;
  visible_group_ids: string[] | null;
};

const chip = "inline-block cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-medium";
const chipOn = "border-zinc-900 bg-zinc-900 text-white";
const chipOff = "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400";

// Per-note controls for the owner: change who can see it, fix the text of
// notes they wrote, or delete it. Tucked behind a quiet "Edit" link.
export function NoteActions({
  note,
  calendarId,
  groups,
}: {
  note: NoteForActions;
  calendarId: string;
  groups: Group[];
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.body_text ?? "");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knownIds = new Set(groups.map((group) => group.id));
  const current = (note.visible_group_ids ?? []).filter((id) => knownIds.has(id));
  const hasDeletedGroup = (note.visible_group_ids ?? []).some((id) => !knownIds.has(id));

  function run(task: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await task();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      }
    });
  }

  function setAudience(next: string[]) {
    run(() =>
      updateEntry(note.id, calendarId, { visible_group_ids: next.length ? next : null })
    );
  }

  return (
    <details className="group mt-0.5">
      <summary className="inline-flex cursor-pointer list-none text-xs font-medium text-zinc-400 hover:text-zinc-700 [&::-webkit-details-marker]:hidden">
        Edit
      </summary>
      <div className="mt-1.5 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-2.5">
        {groups.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-500">Visible to</span>
            <button
              type="button"
              disabled={pending}
              onClick={() => setAudience([])}
              className={`${chip} ${current.length === 0 && !hasDeletedGroup ? chipOn : chipOff}`}
            >
              Everyone
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                type="button"
                disabled={pending}
                aria-pressed={current.includes(group.id)}
                onClick={() =>
                  setAudience(
                    current.includes(group.id)
                      ? current.filter((id) => id !== group.id)
                      : [...current, group.id]
                  )
                }
                className={`${chip} ${current.includes(group.id) ? chipOn : chipOff}`}
              >
                {group.name}
              </button>
            ))}
          </div>
        )}

        {editing ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    await updateEntry(note.id, calendarId, { body_text: text });
                    setEditing(false);
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {pending && <Spinner />}
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setText(note.body_text ?? "");
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            {note.author_type === "owner" ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
              >
                Edit text
              </button>
            ) : (
              <span />
            )}
            {confirming ? (
              <span className="flex items-center gap-2 text-xs text-zinc-600">
                Delete this note?
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => deleteEntry(note.id, calendarId))}
                  className="inline-flex items-center gap-1.5 font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {pending && <Spinner className="h-3 w-3" />}
                  {pending ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                  className="font-medium text-zinc-500 hover:text-zinc-800"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="text-xs font-medium text-zinc-400 hover:text-red-600"
              >
                Delete note
              </button>
            )}
          </div>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </details>
  );
}
