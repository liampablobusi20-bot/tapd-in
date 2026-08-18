"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  setGuestSmsNotify,
  setGuestEmailNotify,
  clearGuestNotify,
} from "@/lib/actions/guest-notify";

const legalLinks = (
  <>
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
  </>
);

export function NotifyToggle({
  token,
  notifyVia,
  phone,
  email,
}: {
  token: string;
  notifyVia: "email" | "sms" | null;
  phone: string | null;
  email: string | null;
}) {
  const [smsState, smsAction, smsPending] = useActionState(
    setGuestSmsNotify.bind(null, token),
    undefined
  );
  const [emailState, emailAction, emailPending] = useActionState(
    setGuestEmailNotify.bind(null, token),
    undefined
  );
  const [turningOff, startTransition] = useTransition();
  const [switching, setSwitching] = useState(false);
  const prevNotifyVia = useRef(notifyVia);

  useEffect(() => {
    if (prevNotifyVia.current !== notifyVia) {
      setSwitching(false);
      prevNotifyVia.current = notifyVia;
    }
  }, [notifyVia]);

  if (notifyVia === "sms" || notifyVia === "email") {
    const otherLabel = notifyVia === "sms" ? "email" : "text";

    if (switching) {
      return (
        <div
          id="notify-settings"
          className="mt-3 scroll-mt-4 rounded-lg border border-zinc-200 bg-white px-3 py-3"
        >
          <p className="text-xs font-medium text-zinc-500">
            Switch to {otherLabel}
          </p>
          {notifyVia === "sms" ? (
            <form action={emailAction} className="mt-2 flex items-center gap-2">
              <input
                type="email"
                name="email"
                placeholder="Email address"
                className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
              />
              <button
                type="submit"
                disabled={emailPending}
                className="flex-shrink-0 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {emailPending ? "Saving…" : "Switch"}
              </button>
            </form>
          ) : (
            <form action={smsAction} className="mt-2 flex items-center gap-2">
              <input
                type="tel"
                name="phone"
                placeholder="Phone number"
                className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
              />
              <button
                type="submit"
                disabled={smsPending}
                className="flex-shrink-0 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {smsPending ? "Saving…" : "Switch"}
              </button>
            </form>
          )}
          {(smsState?.error || emailState?.error) && (
            <p className="mt-1 text-xs text-red-600">
              {smsState?.error || emailState?.error}
            </p>
          )}
          <button
            onClick={() => setSwitching(false)}
            className="mt-2 text-xs font-medium text-zinc-400 hover:text-zinc-600"
          >
            Cancel
          </button>
        </div>
      );
    }

    return (
      <div
        id="notify-settings"
        className="mt-3 scroll-mt-4 flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600"
      >
        <span>
          {notifyVia === "sms"
            ? `Texting updates to ${phone}`
            : `Emailing updates to ${email}`}
        </span>
        <div className="flex flex-shrink-0 items-center gap-3">
          <button
            onClick={() => setSwitching(true)}
            className="font-medium text-zinc-500 hover:text-zinc-900"
          >
            Switch to {otherLabel}
          </button>
          <button
            onClick={() => startTransition(async () => await clearGuestNotify(token))}
            disabled={turningOff}
            className="font-medium text-zinc-500 hover:text-red-600 disabled:opacity-50"
          >
            {turningOff ? "Turning off…" : "Turn off"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="notify-settings"
      className="mt-3 scroll-mt-4 rounded-lg border border-zinc-200 bg-white px-3 py-3"
    >
      <p className="text-xs font-medium text-zinc-500">
        Get updates about this project
      </p>

      <form action={smsAction} className="mt-2 flex items-center gap-2">
        <input
          type="tel"
          name="phone"
          placeholder="Phone number"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={smsPending}
          className="flex-shrink-0 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {smsPending ? "Saving…" : "Text me"}
        </button>
      </form>
      {smsState?.error && (
        <p className="mt-1 text-xs text-red-600">{smsState.error}</p>
      )}

      <form action={emailAction} className="mt-2 flex items-center gap-2">
        <input
          type="email"
          name="email"
          placeholder="Email address"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={emailPending}
          className="flex-shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400 disabled:opacity-50"
        >
          {emailPending ? "Saving…" : "Email me"}
        </button>
      </form>
      {emailState?.error && (
        <p className="mt-1 text-xs text-red-600">{emailState.error}</p>
      )}

      <p className="mt-2 text-[11px] leading-snug text-zinc-500">
        You can only be subscribed to one at a time — choosing text or email
        replaces any existing notification setting. Msg &amp; data rates may
        apply for texts. Reply STOP to unsubscribe, HELP for help.{" "}
        {legalLinks}
      </p>
    </div>
  );
}
