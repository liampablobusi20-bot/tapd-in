"use client";

import { useActionState } from "react";
import { verifyLogin } from "@/lib/actions/auth";
import { btnPrimary, field, label } from "@/components/ui";

export function VerifyForm() {
  const [state, action, pending] = useActionState(verifyLogin, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className={label}>
          6-digit code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
          className={`${field} text-center text-lg tracking-[0.3em]`}
        />
      </div>
      {state?.error && <p className="text-sm text-alert">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btnPrimary} mt-2 w-full py-3`}>
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
