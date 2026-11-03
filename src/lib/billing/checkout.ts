// What we ask Stripe for when someone subscribes. Pure, so the rules are testable without Stripe.

const HOUR_MS = 3_600_000;
// Stripe only accepts a trial end at least 48 hours away.
export const MIN_TRIAL_REMAINING_MS = 48 * HOUR_MS;

export type CheckoutInput = {
  ownerId: string;
  email: string;
  stripeCustomerId?: string | null;
  monthlyPriceCents: number;
  trialEndsAt?: string | null;
  siteUrl: string;
  nowMs: number;
};

// An existing trial carries over: nothing is charged until it ends. If less than 48 hours
// remain (or there is no trial), they are charged now.
export function checkoutParams(i: CheckoutInput) {
  const end = i.trialEndsAt ? Date.parse(i.trialEndsAt) : NaN;
  const carryTrial = Number.isFinite(end) && end - i.nowMs >= MIN_TRIAL_REMAINING_MS;
  return {
    mode: "subscription" as const,
    client_reference_id: i.ownerId,
    metadata: { owner_id: i.ownerId },
    ...(i.stripeCustomerId ? { customer: i.stripeCustomerId } : { customer_email: i.email }),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: i.monthlyPriceCents,
          recurring: { interval: "month" as const },
          product_data: { name: "Tapd In" },
        },
      },
    ],
    subscription_data: {
      metadata: { owner_id: i.ownerId },
      ...(carryTrial ? { trial_end: Math.floor(end / 1000) } : {}),
    },
    payment_method_collection: "always" as const,
    success_url: `${i.siteUrl}/dashboard/settings?billing=success`,
    cancel_url: `${i.siteUrl}/dashboard/settings?billing=cancelled`,
  };
}

export const formatPrice = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}/month`;

// "$99", "99.50", "$1,200" to cents. null when it isn't a sensible price.
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents >= 100 && cents <= 5_000_000 ? cents : null;
}
