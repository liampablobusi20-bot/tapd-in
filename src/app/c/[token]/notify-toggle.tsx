"use client";

import { useActionState, useTransition } from "react";
import { setGuestSmsNotify, clearGuestNotify } from "@/lib/actions/guest-notify";

export function NotifyToggle({
  token,
  notifyVia,
  phone,
}: {
  token: string;
  notifyVia: "email" | "sms" | null;
  phone: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    setGuestSmsNotify.bind(null, token),
    undefined
  );
  const [turningOff, startTransition] = useTransition();

  if (notifyVia === "sms") {
    return (
      <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600">
        <span>Texting updates to {phone}</span>
        <button
          onClick={() => startTransition(async () => await clearGuestNotify(token))}
          disabled={turningOff}
          className="flex-shrink-0 font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50"
        >
          {turningOff ? "Turning off…" : "Turn off"}
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-3 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-3"
    >
      <div className="flex items-center gap-2">
        <input
          type="tel"
          name="phone"
          placeholder="Phone number"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex-shrink-0 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Text me updates"}
        </button>
      </div>
      <p className="text-[11px] leading-snug text-zinc-500">
        Msg &amp; data rates may apply. Reply STOP to unsubscribe, HELP for help.{" "}
        <a
          href="https://tapd-in-privacy-policy.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Privacy
        </a>{" "}
        ·{" "}
        <a
          href="https://tapd-in-terms-of-service.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Terms
        </a>
      </p>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
