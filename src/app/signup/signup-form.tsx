"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/lib/actions/auth";
import { btnPrimary, field, label } from "@/components/ui";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);

  if (state?.needsConfirmation) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl tracking-tight">Check your email</h2>
        <p className="text-sm leading-relaxed text-muted">
          We sent you a confirmation link. Click it to activate your account, then come back and log
          in.
        </p>
        <Link href="/login" className="mt-3 text-sm font-medium text-ink underline underline-offset-4">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={label}>
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={field} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={label}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className={field}
        />
        <p className="text-xs text-faint">At least 8 characters.</p>
      </div>
      {state?.error && <p className="text-sm text-alert">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btnPrimary} mt-2 w-full py-3`}>
        {pending ? "Creating account…" : "Request access"}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
    </form>
  );
}
