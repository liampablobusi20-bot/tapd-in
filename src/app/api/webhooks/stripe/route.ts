import { NextResponse } from "next/server";
import { applyStripeEvent } from "@/lib/billing/apply";
import { stripeClient } from "@/lib/billing/stripe";

// Stripe tells us here when someone subscribes, pays, fails to pay, or cancels. Every call is
// checked against the signing secret first; anything that doesn't verify is refused.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Billing isn't configured." }, { status: 501 });
  }

  // The raw body, exactly as sent, is what the signature covers.
  const body = await request.text();
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    // Say why, and what shape the stored secret has, so a setup mistake can be found. Never the secret itself.
    console.error("Stripe signature check failed:", err instanceof Error ? err.message : "unknown error", {
      secretStartsWithWhsec: secret.startsWith("whsec_"),
      secretLength: secret.length,
      secretHasWhitespaceOrQuotes: /[\s"']/.test(secret),
      signatureHeaderLooksRight: /^t=\d+,/.test(signature),
    });
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    const outcome = await applyStripeEvent(event);
    return NextResponse.json({ received: true, outcome });
  } catch (err) {
    console.error("Stripe event failed:", event.type, err instanceof Error ? err.message : "unknown error");
    // A failure here asks Stripe to deliver it again.
    return NextResponse.json({ error: "Couldn't process the event." }, { status: 500 });
  }
}
