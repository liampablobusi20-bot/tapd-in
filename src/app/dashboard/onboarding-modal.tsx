"use client";

import { useState, useTransition } from "react";
import { completeOnboarding } from "@/lib/actions/onboarding";
import { AddToHomeScreenButton } from "@/components/add-to-home-screen-button";

const steps = [
  {
    title: "Welcome to Tapd In",
    body: "A shared project calendar you can send to clients and subs — no app or account needed on their end. Here's a quick walkthrough.",
  },
  {
    title: "Create a calendar",
    body: "Each project gets its own calendar. Add phases with a name, target date, and notes — that becomes the schedule your guests see.",
  },
  {
    title: "Invite people",
    body: "From a calendar, click “Invite people” to generate a link. Choose view-only or comment access — no login required on their end.",
  },
  {
    title: "Updates go out automatically",
    body: "Whenever you or a guest post an update, anyone who's opted into notifications gets a text or email pointing back to the calendar.",
  },
  {
    title: "Add to your home screen",
    body: "Get one-tap access from your phone, just like an app.",
  },
];

export function OnboardingModal() {
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();

  if (dismissed) return null;

  const isLast = step === steps.length - 1;
  const current = steps[step];

  function finish() {
    setDismissed(true);
    startTransition(async () => await completeOnboarding());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Step {step + 1} of {steps.length}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">
          {current.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {current.body}
        </p>
        {isLast && (
          <div className="mt-3">
            <AddToHomeScreenButton />
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={finish}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-600"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-400"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
              className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              {isLast ? "Get started" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
