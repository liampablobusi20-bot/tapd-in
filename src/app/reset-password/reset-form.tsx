"use client";

import { useActionState } from "react";
import { updatePassword } from "@/lib/actions/auth";
import { btnPrimary, field, label } from "@/components/ui";

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={label}>
          New password
        </label>
        <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm" className={label}>
          Type it again
        </label>
        <input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" className={field} />
      </div>
      {state?.error && <p className="text-sm text-alert">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btnPrimary} mt-2 w-full py-3`}>
        {pending ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
