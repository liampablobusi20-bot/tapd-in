import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/inbox/activity-log";
import { planEvent, type UserUpdate } from "@/lib/billing/map";

type Column = Record<string, unknown>;

// What an event does to one account, as database columns.
function toColumns(update: UserUpdate, currentIssueAt: string | null): Column {
  const cols: Column = {};
  if (update.subscription_status !== undefined) cols.subscription_status = update.subscription_status;
  if (update.stripe_subscription_id !== undefined) cols.stripe_subscription_id = update.stripe_subscription_id;
  if (update.stripe_customer_id !== undefined) cols.stripe_customer_id = update.stripe_customer_id;
  if (update.trial_ends_at !== undefined) cols.trial_ends_at = update.trial_ends_at;
  // The grace period counts from the first failure, so a retry that fails again doesn't restart it.
  if (update.billing_issue === "start") cols.billing_issue_at = currentIssueAt ?? new Date().toISOString();
  if (update.billing_issue === "clear") cols.billing_issue_at = null;
  return cols;
}

export type ApplyOutcome = "applied" | "duplicate" | "ignored" | "unknown-account";

// Applies one verified Stripe event. Each event id is only ever applied once.
export async function applyStripeEvent(event: Stripe.Event): Promise<ApplyOutcome> {
  const admin = createAdminClient();
  const plan = planEvent(event as unknown as Parameters<typeof planEvent>[0]);
  if (!plan) return "ignored";

  const { error: dupe } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dupe) {
    if (dupe.code === "23505") return "duplicate";
    throw new Error(dupe.message);
  }

  try {
    // The account is found by the id we attached when it subscribed, or failing that by its Stripe customer id.
    let ownerId = plan.ownerId;
    if (!ownerId && plan.customerId) {
      const { data } = await admin.from("users").select("id").eq("stripe_customer_id", plan.customerId).maybeSingle();
      ownerId = data?.id;
    }
    if (!ownerId) {
      await admin.from("stripe_events").delete().eq("id", event.id); // can't place it: let a later delivery try again
      return "unknown-account";
    }
    const { data: current } = await admin.from("users").select("billing_issue_at").eq("id", ownerId).maybeSingle();
    const cols = toColumns(plan.update, current?.billing_issue_at ?? null);
    if (Object.keys(cols).length > 0) {
      const { error } = await admin.from("users").update(cols).eq("id", ownerId);
      if (error) throw new Error(error.message);
    }
    if (plan.activity) await logActivity(ownerId, plan.activity);
    return "applied";
  } catch (err) {
    await admin.from("stripe_events").delete().eq("id", event.id); // so Stripe's retry is processed
    throw err;
  }
}
