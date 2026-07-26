"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

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
          autoComplete="current-password"
          className="rounded-md border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-zinc-900 focus:outline-none"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-base font-medium text-white disabled:opacity-50"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="text-sm text-zinc-600">
        No account?{" "}
        <Link href="/signup" className="font-medium text-zinc-900 underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
