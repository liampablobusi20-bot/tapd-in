"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "@/lib/actions/auth";

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);

  if (state?.needsConfirmation) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-zinc-900">
          Check your email
        </h2>
        <p className="text-sm text-zinc-600">
          We sent you a confirmation link. Click it to activate your account,
          then come back and log in.
        </p>
        <Link
          href="/login"
          className="mt-2 text-sm font-medium text-zinc-900 underline"
        >
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-zinc-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          className="rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none"
        />
        <p className="text-xs text-zinc-500">At least 8 characters.</p>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-base font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating account…" : "Sign up"}
      </button>
      <p className="text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
