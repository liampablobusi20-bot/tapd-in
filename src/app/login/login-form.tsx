"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/lib/actions/auth";
import { btnPrimary, field, label } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

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
          autoComplete="current-password"
          className={field}
        />
      </div>
      {state?.error && <p className="text-sm text-alert">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btnPrimary} mt-2 w-full py-3`}>
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-medium text-ink underline underline-offset-4">
          Request access
        </Link>
      </p>
    </form>
  );
}
