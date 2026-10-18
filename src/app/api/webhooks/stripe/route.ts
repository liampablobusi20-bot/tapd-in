import { NextResponse } from "next/server";

// TODO(stripe): billing is scaffolded but not wired up yet. When ready:
// 1. Add a `stripe_customer_id` column to `public.users`.
// 2. Report each account's monthly usage (inbox_messages.cost_micros, see
//    src/lib/inbox/pricing.ts) to Stripe as metered usage.
// 3. Point a Stripe webhook at this route, verify the signature with
//    `stripe.webhooks.constructEvent`, and on `checkout.session.completed` /
//    `customer.subscription.updated` / `customer.subscription.deleted`
//    events, update the matching user's `plan` and `subscription_status`.
export async function POST() {
  return NextResponse.json(
    { error: "Stripe billing is not configured yet." },
    { status: 501 }
  );
}
