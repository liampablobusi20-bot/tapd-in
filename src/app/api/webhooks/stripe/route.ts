import { NextResponse } from "next/server";

// TODO(stripe): billing is scaffolded but not wired up yet. When ready:
// 1. Add a `stripe_customer_id` column to `public.users`.
// 2. Create Checkout Sessions from the dashboard (see the free-plan-limit
//    message in src/app/dashboard/page.tsx and the TODO in
//    createCalendar() at src/lib/actions/calendars.ts — that's where the
//    upgrade flow would be triggered from).
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
