import Stripe from "stripe";
import { checkoutParams } from "@/lib/billing/checkout";

// Billing stays switched off until a Stripe key is set, so nothing about it shows to customers early.
export const billingConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Billing isn't set up yet.");
  return new Stripe(key);
}

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

export type BillingOwner = {
  id: string;
  email: string;
  stripe_customer_id: string | null;
  monthly_price_cents: number | null;
  trial_ends_at: string | null;
};

// A Stripe-hosted page where the person enters a card. Their remaining trial carries over, so
// nothing is charged until it ends.
export async function createCheckoutUrl(owner: BillingOwner): Promise<string> {
  if (!owner.monthly_price_cents) throw new Error("No price has been set for this account.");
  const params = checkoutParams({
    ownerId: owner.id,
    email: owner.email,
    stripeCustomerId: owner.stripe_customer_id,
    monthlyPriceCents: owner.monthly_price_cents,
    trialEndsAt: owner.trial_ends_at,
    siteUrl: siteUrl(),
    nowMs: Date.now(),
  });
  const session = await stripeClient().checkout.sessions.create(params);
  if (!session.url) throw new Error("Stripe didn't return a checkout link.");
  return session.url;
}

// Stripe's page for updating a card, seeing invoices, or cancelling.
export async function createPortalUrl(customerId: string): Promise<string> {
  const session = await stripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl()}/dashboard/settings`,
  });
  return session.url;
}
