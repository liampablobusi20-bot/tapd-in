"use client";

import { useActionState } from "react";
import { createCalendar } from "@/lib/actions/calendars";

export function CreateCalendarForm() {
  const [state, formAction, pending] = useActionState(
    createCalendar,
    undefined
  );

  return (
    <form
      action={formAction}
      className="mt-6 flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <div className="flex gap-2">
        <input
          name="name"
          required
          placeholder="Project name (e.g. 214 Maple St remodel)"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors placeholder:text-zinc-400 hover:border-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/5"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex-shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Creating…" : "New calendar"}
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
