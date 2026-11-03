import { PayButton } from "./billing-parts";
import { formatPrice } from "@/lib/billing/checkout";
import type { TrialState } from "@/lib/inbox/trial";

const CONTACT = "mailto:liampablobusi20@gmail.com?subject=Tapd%20In%20subscription";

// "Plan and billing" in Settings. Nothing is shown to someone with no trial limit.
export function BillingCard({
  state,
  priceCents,
  hasCustomer,
  billing,
  card,
}: {
  state: TrialState;
  priceCents: number | null;
  hasCustomer: boolean;
  billing: boolean;
  card: string;
}) {
  if (state.state === "none") return null;
  const price = priceCents ? formatPrice(priceCents) : null;
  const canPay = billing && Boolean(priceCents);

  let headline = "";
  let body = "";
  let action: React.ReactNode = null;
  switch (state.state) {
    case "paid":
      headline = "Your subscription is active";
      body = price ? `${price}.` : "";
      action = billing && hasCustomer ? <PayButton kind="portal" label="Manage billing" className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink hover:border-ink/30" /> : null;
      break;
    case "trial":
      headline = `Free trial: ${state.daysLeft} ${state.daysLeft === 1 ? "day" : "days"} left`;
      body = state.cardOnFile
        ? `Your card is on file. Billing${price ? ` (${price})` : ""} starts when the trial ends. You can cancel before then and you won't be charged.`
        : canPay
          ? `Add a payment method now to keep going when the trial ends${price ? ` (${price})` : ""}. You won't be charged until then.`
          : "To keep going after your trial, get in touch and we'll set it up.";
      action = state.cardOnFile ? (
        billing && hasCustomer ? <PayButton kind="portal" label="Manage billing" className="rounded-full border border-line px-5 py-2.5 text-sm font-medium text-ink hover:border-ink/30" /> : null
      ) : canPay ? (
        <PayButton kind="checkout" label="Add payment method" />
      ) : null;
      break;
    case "grace":
      headline = "Your trial has ended";
      body = `You have ${state.daysLeft} ${state.daysLeft === 1 ? "day" : "days"} before your briefing pauses. Everything stays saved either way.`;
      action = canPay ? <PayButton kind="checkout" label="Subscribe" /> : null;
      break;
    case "payment_issue":
      headline = "A payment didn't go through";
      body = `Please update your payment method within ${state.daysLeft} ${state.daysLeft === 1 ? "day" : "days"} to keep your briefing going.`;
      action = billing && hasCustomer ? <PayButton kind="portal" label="Update payment method" /> : null;
      break;
    case "paused":
      return null; // the paused screen is shown instead of Settings
  }

  return (
    <section id="billing" className="mt-14">
      <h2 className="text-lg font-semibold tracking-tight">Plan and billing</h2>
      <div className={card}>
        <p className="font-medium">{headline}</p>
        {body && <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">{body}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {action}
          {!canPay && state.state !== "paid" && (
            <a href={CONTACT} className="text-sm font-medium text-ink underline underline-offset-4">
              Email us about continuing
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
