import Link from "next/link";
import { btnSecondary, eyebrow } from "@/components/ui";
import type { TrialState } from "@/lib/inbox/trial";
import { PayButton } from "./billing-parts";

const CONTACT = "mailto:liampablobusi20@gmail.com?subject=Tapd%20In%20subscription";
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

// A quiet line at the top while on a trial or if something needs attention. Nothing for people
// who are paying or who have no limit.
export function TrialBanner({ state, billing }: { state: TrialState; billing: boolean }) {
  const link = (text: string) => (
    <Link href="/dashboard/settings#billing" className="font-medium underline underline-offset-4">
      {text}
    </Link>
  );
  if (state.state === "trial") {
    return (
      <p className="border-b border-line bg-card px-6 py-2.5 text-center text-xs text-muted">
        Free trial: {days(state.daysLeft)} left. {state.cardOnFile ? "Billing starts when it ends." : billing ? <>{link("Add a payment method")} to keep going.</> : <>Questions? <a href={CONTACT} className="underline underline-offset-4">Email us</a>.</>}
      </p>
    );
  }
  if (state.state === "grace") {
    return (
      <p className="border-b border-alert/20 bg-alert-soft px-6 py-2.5 text-center text-xs text-alert">
        Your trial has ended. {days(state.daysLeft)} left to keep your briefing going. {billing ? link("Subscribe") : <a href={CONTACT} className="font-medium underline underline-offset-4">Email us</a>}
      </p>
    );
  }
  if (state.state === "payment_issue") {
    return (
      <p className="border-b border-alert/20 bg-alert-soft px-6 py-2.5 text-center text-xs text-alert">
        A payment didn&apos;t go through. {days(state.daysLeft)} left to fix it. {billing ? link("Update payment") : <a href={CONTACT} className="font-medium underline underline-offset-4">Email us</a>}
      </p>
    );
  }
  return null;
}

const COPY = {
  trial_ended: { title: "Your trial has ended.", body: "Subscribe to pick up where you left off. Everything you had is still here, and new mail will be sorted again straight away." },
  payment_failed: { title: "We couldn't take your payment.", body: "Update your payment method to continue. Your data is safe and nothing has been deleted." },
  canceled: { title: "Your subscription has ended.", body: "You can restart any time. Your data is still here." },
} as const;

// Shown instead of the app when an account is paused. The data is kept.
export function PausedScreen({ reason, billing, canPay, hasCustomer }: { reason: keyof typeof COPY; billing: boolean; canPay: boolean; hasCustomer: boolean }) {
  const copy = COPY[reason];
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <p className={eyebrow}>Paused</p>
      <h1 className="mt-5 font-display text-5xl leading-[1.05] tracking-tight">{copy.title}</h1>
      <p className="mt-6 text-lg leading-relaxed text-muted">{copy.body}</p>
      <div className="mt-9 flex flex-col items-center gap-3">
        {billing && canPay && <PayButton kind="checkout" label="Subscribe" />}
        {billing && !canPay && hasCustomer && <PayButton kind="portal" label="Update payment method" />}
        <a href={CONTACT} className={btnSecondary}>
          {billing && canPay ? "Questions? Email us" : "Email us to continue"}
        </a>
      </div>
    </div>
  );
}
