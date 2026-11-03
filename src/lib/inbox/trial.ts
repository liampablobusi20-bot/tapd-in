// Access rules: a free trial, then either billing starts (a card is on file) or a short
// grace period and the account pauses (its data is kept). A failed payment gets the same
// grace period. Pure, so every rule can be tested.

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 3;
const DAY_MS = 86_400_000;

export type Account = {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  stripe_subscription_id?: string | null;
  billing_issue_at?: string | null;
};

export type TrialState =
  | { state: "none" } // no limit: accounts set up before trials existed
  | { state: "paid" }
  | { state: "trial"; daysLeft: number; endsAt: string; cardOnFile: boolean }
  | { state: "grace"; daysLeft: number; endsAt: string } // trial ended without a card; days left before pausing
  | { state: "payment_issue"; daysLeft: number } // a payment failed; days left before pausing
  | { state: "paused"; reason: "trial_ended" | "payment_failed" | "canceled" };

const daysUntil = (ms: number, nowMs: number) => Math.max(1, Math.ceil((ms - nowMs) / DAY_MS));

export function trialState(account: Account, nowMs: number): TrialState {
  const status = account.subscription_status ?? "trialing";
  if (status === "active") return { state: "paid" };
  if (status === "canceled") return { state: "paused", reason: "canceled" };
  if (status === "past_due") {
    const since = account.billing_issue_at ? Date.parse(account.billing_issue_at) : nowMs;
    const graceEnd = (Number.isNaN(since) ? nowMs : since) + GRACE_DAYS * DAY_MS;
    return nowMs < graceEnd ? { state: "payment_issue", daysLeft: daysUntil(graceEnd, nowMs) } : { state: "paused", reason: "payment_failed" };
  }
  if (!account.trial_ends_at) return { state: "none" };
  const end = Date.parse(account.trial_ends_at);
  if (Number.isNaN(end)) return { state: "none" };
  const cardOnFile = Boolean(account.stripe_subscription_id);
  if (nowMs < end) return { state: "trial", daysLeft: daysUntil(end, nowMs), endsAt: account.trial_ends_at, cardOnFile };
  // A trial with a card on file is charged by Stripe when it ends, and Stripe tells us how that went.
  // Until it does, the account keeps working rather than being paused by a delay.
  if (cardOnFile) return { state: "trial", daysLeft: 1, endsAt: account.trial_ends_at, cardOnFile };
  const graceEnd = end + GRACE_DAYS * DAY_MS;
  return nowMs < graceEnd
    ? { state: "grace", daysLeft: daysUntil(graceEnd, nowMs), endsAt: account.trial_ends_at }
    : { state: "paused", reason: "trial_ended" };
}

export const isPaused = (s: TrialState) => s.state === "paused";

export const newTrialEnd = (nowMs: number) => new Date(nowMs + TRIAL_DAYS * DAY_MS).toISOString();

// Extending always counts from today at the earliest, so extending a long-ended trial gives a real week.
export function extendedEnd(current: string | null | undefined, nowMs: number, days = 7): string {
  const base = current && Date.parse(current) > nowMs ? Date.parse(current) : nowMs;
  return new Date(base + days * DAY_MS).toISOString();
}
