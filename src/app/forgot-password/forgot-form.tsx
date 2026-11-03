"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";
import { btnPrimary, field, label } from "@/components/ui";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);

  if (state?.sent) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl tracking-tight">Check your email</h1>
        <p className="text-sm leading-relaxed text-muted">
          If there&apos;s an account for that email, we&apos;ve sent a link to choose a new password. It can take a minute to arrive, and it&apos;s worth
          checking spam.
        </p>
        <Link href="/login" className="mt-3 text-sm font-medium text-ink underline underline-offset-4">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-3xl tracking-tight">Forgot your password?</h1>
        <p className="mt-1.5 text-sm text-muted">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        <label htmlFor="email" className={label}>
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={field} />
      </div>
      {state?.error && <p className="text-sm text-alert">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btnPrimary} mt-2 w-full py-3`}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
