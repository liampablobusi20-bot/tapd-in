"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { completeOnboarding } from "@/lib/actions/onboarding";
import {
  isTourDoneHere,
  markTourDoneHere,
  readActiveStep,
  setActiveStep,
  subscribeTour,
  type TourVariant,
} from "./tour-store";
import { GUEST_STEPS, OWNER_STEPS, type TourStep } from "./tour-steps";

const POPOVER_WIDTH = 320;
const EDGE = 12;

type Rect = { top: number; left: number; width: number; height: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function StepCard({
  step,
  index,
  total,
  onNext,
  onBack,
  onSkip,
  onMissing,
}: {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onMissing: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const isLast = index === total - 1;

  // Find the element this step points at, scroll it into view, and keep
  // following it (scrolling, resizing, layout shifts). If it never shows up,
  // that step doesn't apply here and is skipped.
  useEffect(() => {
    if (!step.target) return;
    let cancelled = false;
    let tries = 0;
    let scrolled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) {
        if (++tries > 25) return onMissing();
        timer = setTimeout(tick, 100);
        return;
      }
      if (!scrolled) {
        scrolled = true;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      const box = el.getBoundingClientRect();
      setRect({ top: box.top, left: box.left, width: box.width, height: box.height });
      timer = setTimeout(tick, 120);
    };
    timer = setTimeout(tick, 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [step.target, onMissing]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onSkip();
      else if (event.key === "ArrowRight") onNext();
      else if (event.key === "ArrowLeft" && index > 0) onBack();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onNext, onBack, onSkip, index]);

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [index]);

  const centered = !step.target;
  if (!centered && !rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(POPOVER_WIDTH, vw - EDGE * 2);

  let placement: React.CSSProperties;
  let arrow: { left: number; below: boolean } | null = null;
  if (centered || !rect) {
    placement = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width };
  } else {
    const spaceBelow = vh - (rect.top + rect.height);
    const spaceAbove = rect.top;
    const left = clamp(rect.left + rect.width / 2 - width / 2, EDGE, vw - width - EDGE);
    const arrowLeft = clamp(rect.left + rect.width / 2 - left - 6, 16, width - 28);
    if (spaceBelow >= 210) {
      placement = { left, top: rect.top + rect.height + 14, width };
      arrow = { left: arrowLeft, below: false };
    } else if (spaceAbove >= 210) {
      placement = { left, bottom: vh - rect.top + 14, width };
      arrow = { left: arrowLeft, below: true };
    } else {
      placement = { left: (vw - width) / 2, bottom: EDGE, width };
    }
  }

  return (
    <>
      {/* Blocks clicks on the page while the tour is open. */}
      <div className={`fixed inset-0 z-[70] ${centered ? "bg-zinc-900/50" : ""}`} />
      {rect && !centered && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[71] rounded-xl transition-all duration-150"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(24, 24, 27, 0.55)",
          }}
        />
      )}
      <div
        role="dialog"
        aria-label={step.title}
        className="fixed z-[72] rounded-2xl bg-white p-4 shadow-2xl"
        style={placement}
      >
        {arrow && (
          <span
            aria-hidden
            className={`absolute h-3 w-3 rotate-45 bg-white ${
              arrow.below ? "-bottom-1.5" : "-top-1.5"
            }`}
            style={{ left: arrow.left }}
          />
        )}
        <p className="text-xs font-medium text-zinc-400">
          {index + 1} of {total}
        </p>
        <h3 className="mt-0.5 text-base font-semibold text-zinc-900">{step.title}</h3>
        <p className="mt-1 text-sm leading-snug text-zinc-600">{step.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-700"
          >
            {isLast ? "Close" : "Skip tour"}
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
              >
                Back
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={onNext}
              className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// One-time guided tour with bubbles pointing at the real controls. Owners see
// it on first sign-in and guests on their first visit; both can replay it from
// the menu ("How to use").
export function ProductTour({
  variant,
  autoStart = false,
  firstCalendarId = null,
}: {
  variant: TourVariant;
  autoStart?: boolean;
  firstCalendarId?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const steps = variant === "owner" ? OWNER_STEPS : GUEST_STEPS;
  const page = pathname === "/dashboard" ? "dashboard" : "calendar";

  const snapshot = useSyncExternalStore(
    subscribeTour,
    () => String(readActiveStep(variant)),
    () => "null"
  );
  const active = snapshot === "null" ? null : Number(snapshot);
  const step = active === null ? undefined : steps[active];

  useEffect(() => {
    if (autoStart && !isTourDoneHere(variant) && readActiveStep(variant) === null) {
      setActiveStep(variant, 0);
    }
  }, [autoStart, variant]);

  function finish() {
    markTourDoneHere(variant);
    setActiveStep(variant, null);
    if (variant === "owner") void completeOnboarding();
  }

  const goTo = (next: number) => {
    if (next >= steps.length) return finish();
    setActiveStep(variant, Math.max(0, next));
  };

  // Steps can live on different pages (dashboard, then a calendar). Move there.
  const wrongPage = variant === "owner" && step?.page && step.page !== page;
  useEffect(() => {
    if (!wrongPage || !step) return;
    if (step.page === "dashboard") router.push("/dashboard");
    else if (firstCalendarId) router.push(`/dashboard/calendars/${firstCalendarId}`);
    else finish();
    // finish is stable enough for this one-shot navigation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrongPage, step?.page, firstCalendarId]);

  if (active === null || !step || wrongPage) return null;

  return (
    <StepCard
      key={active}
      step={step}
      index={active}
      total={steps.length}
      onNext={() => goTo(active + 1)}
      onBack={() => goTo(active - 1)}
      onSkip={finish}
      onMissing={() => goTo(active + 1)}
    />
  );
}
