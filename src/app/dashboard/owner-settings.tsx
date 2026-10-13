"use client";

import { useActionState } from "react";
import { updateOwnerSettings } from "@/lib/actions/owner-settings";

export function OwnerSettings({
  email,
  displayName,
  notifyEmail,
}: {
  email: string;
  displayName: string | null;
  notifyEmail: boolean;
}) {
  const [state, action, pending] = useActionState(updateOwnerSettings, undefined);

  return (
    <form
      data-tour="settings"
      action={action}
      className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-zinc-900">Your settings</h2>

      <label className="mt-3 block text-sm text-zinc-700">
        Your name
        <input
          name="display_name"
          defaultValue={displayName ?? ""}
          maxLength={60}
          placeholder={email}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
        />
      </label>

      <label className="mt-3 flex items-start gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          name="notify_email"
          defaultChecked={notifyEmail}
          className="mt-0.5"
        />
        <span>
          Email me when guests post or change things
        </span>
      </label>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.saved && <span className="text-sm text-emerald-700">Saved</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
