export type TourVariant = "owner" | "guest";

const activeKey = (variant: TourVariant) => `tapdin-tour-active-${variant}`;
const doneKey = (variant: TourVariant) => `tapdin-tour-done-${variant}`;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function subscribeTour(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

// In progress lives in sessionStorage so the tour can follow you from the
// dashboard into a calendar, but ends with the tab.
export function readActiveStep(variant: TourVariant): number | null {
  try {
    const value = sessionStorage.getItem(activeKey(variant));
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}

export function setActiveStep(variant: TourVariant, step: number | null) {
  try {
    if (step === null) sessionStorage.removeItem(activeKey(variant));
    else sessionStorage.setItem(activeKey(variant), String(step));
  } catch {
    // storage unavailable: the tour just won't persist across pages
  }
  notify();
}

export function isTourDoneHere(variant: TourVariant): boolean {
  try {
    return localStorage.getItem(doneKey(variant)) === "1";
  } catch {
    return false;
  }
}

export function markTourDoneHere(variant: TourVariant) {
  try {
    localStorage.setItem(doneKey(variant), "1");
  } catch {
    // ignore
  }
}

// Used by the "How to use" menu items to replay the tour from the start.
export function startTour(variant: TourVariant) {
  setActiveStep(variant, 0);
}
