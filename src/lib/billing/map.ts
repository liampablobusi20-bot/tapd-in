// Turning what Stripe tells us into what an account is allowed to do. Pure.

export type OurStatus = "trialing" | "active" | "past_due" | "canceled";

// Stripe's subscription statuses, mapped to ours. null means "no change": a payment that
// is still being set up shouldn't switch anything.
export function statusFromStripe(status: string): OurStatus | null {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
    case "paused":
      return "canceled";
    default:
      return null;
  }
}

export type UserUpdate = {
  subscription_status?: OurStatus;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string;
  trial_ends_at?: string | null;
  // 'start' sets it to now unless already set; 'clear' removes it.
  billing_issue?: "start" | "clear";
};

type SubscriptionLike = {
  id: string;
  customer: string | { id: string } | null;
  status: string;
  trial_end: number | null;
};

const customerId = (c: SubscriptionLike["customer"]) => (typeof c === "string" ? c : c?.id ?? undefined);

export function subscriptionUpdate(sub: SubscriptionLike): UserUpdate | null {
  const status = statusFromStripe(sub.status);
  if (!status) return null;
  const update: UserUpdate = { subscription_status: status, stripe_customer_id: customerId(sub.customer) };
  if (status === "canceled") {
    update.stripe_subscription_id = null;
    update.billing_issue = "clear";
    return update;
  }
  update.stripe_subscription_id = sub.id;
  if (status === "trialing") update.trial_ends_at = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  if (status === "active") {
    update.trial_ends_at = null;
    update.billing_issue = "clear";
  }
  if (status === "past_due") update.billing_issue = "start";
  return update;
}

type EventLike = { id: string; type: string; data: { object: Record<string, unknown> } };

// Which account an event is about, and what to change. Anything else is ignored on purpose.
export function planEvent(
  event: EventLike
): { ownerId?: string; customerId?: string; update: UserUpdate; activity?: "subscription_started" | "payment_failed" | "subscription_ended" } | null {
  const o = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": {
      if (o.mode !== "subscription") return null;
      const ownerId = (o.client_reference_id as string | null) ?? ((o.metadata as Record<string, string> | null)?.owner_id ?? undefined);
      if (!ownerId) return null;
      const update: UserUpdate = {};
      if (typeof o.customer === "string") update.stripe_customer_id = o.customer;
      if (typeof o.subscription === "string") update.stripe_subscription_id = o.subscription;
      return { ownerId, update, activity: "subscription_started" };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const update = subscriptionUpdate(o as unknown as SubscriptionLike);
      if (!update) return null;
      const ownerId = (o.metadata as Record<string, string> | null)?.owner_id ?? undefined;
      return { ownerId, customerId: update.stripe_customer_id, update };
    }
    case "customer.subscription.deleted": {
      const update = subscriptionUpdate({ ...(o as unknown as SubscriptionLike), status: "canceled" });
      if (!update) return null;
      const ownerId = (o.metadata as Record<string, string> | null)?.owner_id ?? undefined;
      return { ownerId, customerId: update.stripe_customer_id, update, activity: "subscription_ended" };
    }
    case "invoice.payment_failed": {
      const customer = typeof o.customer === "string" ? o.customer : undefined;
      if (!customer) return null;
      return { customerId: customer, update: { subscription_status: "past_due", billing_issue: "start" }, activity: "payment_failed" };
    }
    case "invoice.paid": {
      const customer = typeof o.customer === "string" ? o.customer : undefined;
      if (!customer) return null;
      return { customerId: customer, update: { subscription_status: "active", trial_ends_at: null, billing_issue: "clear" } };
    }
    default:
      return null;
  }
}
