"use client";

import { useEffect, useState, useTransition } from "react";
import { completeOnboarding } from "@/lib/actions/onboarding";

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function buildSteps(platform: Platform) {
  return [
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
      body:
        platform === "ios"
          ? "On iPhone: tap the Share icon in Safari, scroll down, then tap “Add to Home Screen.”"
          : platform === "android"
            ? "On Android: tap the ⋮ menu in Chrome, then tap “Add to Home screen” or “Install app.”"
            : "Open this site on your phone's browser, then use the browser's “Add to Home Screen” option for one-tap access.",
    },
  ];
}

export function OnboardingModal() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  if (dismissed) return null;

  const steps = buildSteps(platform);
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
