"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions/admin";
import { logActivity } from "@/lib/inbox/activity-log";
import { billingConfigured, createCheckoutUrl, createPortalUrl, type BillingOwner } from "@/lib/billing/stripe";
import { parsePriceToCents } from "@/lib/billing/checkout";
import { extendedEnd } from "@/lib/inbox/trial";

export type UrlResult = { ok: true; url: string } | { ok: false; error: string };
export type PlainResult = { ok: true; message?: string } | { ok: false; error: string };

const COLUMNS = "id, email, stripe_customer_id, monthly_price_cents, trial_ends_at";

async function loadOwner(id: string): Promise<BillingOwner | null> {
  const { data } = await createAdminClient().from("users").select(COLUMNS).eq("id", id).maybeSingle();
  return data;
}

// A paused account can still reach the pause screen, so this checks sign-in only, not whether the inbox is active.
async function currentUserId(): Promise<string | null> {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  return user?.id ?? null;
}

export async function startCheckout(): Promise<UrlResult> {
  const id = await currentUserId();
  if (!id) return { ok: false, error: "Please log in again." };
  if (!billingConfigured()) return { ok: false, error: "Online payment isn't available yet. Please contact us." };
  const owner = await loadOwner(id);
  if (!owner) return { ok: false, error: "Account not found." };
  if (!owner.monthly_price_cents) return { ok: false, error: "Your pricing hasn't been set up yet. Please contact us and we'll sort it out." };
  try {
    return { ok: true, url: await createCheckoutUrl(owner) };
  } catch (err) {
    console.error("Checkout failed:", err instanceof Error ? err.message : "unknown error");
    return { ok: false, error: "Couldn't open the payment page. Please try again." };
  }
}

export async function openBillingPortal(): Promise<UrlResult> {
  const id = await currentUserId();
  if (!id) return { ok: false, error: "Please log in again." };
  const owner = await loadOwner(id);
  if (!owner?.stripe_customer_id || !billingConfigured()) return { ok: false, error: "There's no billing account to manage yet." };
  try {
    return { ok: true, url: await createPortalUrl(owner.stripe_customer_id) };
  } catch (err) {
    console.error("Billing portal failed:", err instanceof Error ? err.message : "unknown error");
    return { ok: false, error: "Couldn't open billing. Please try again." };
  }
}

// ---- administrator actions

export async function setMonthlyPrice(userId: string, text: string): Promise<PlainResult> {
  await requireAdmin();
  const trimmed = text.trim();
  const cents = trimmed === "" ? null : parsePriceToCents(trimmed);
  if (trimmed !== "" && cents === null) return { ok: false, error: "Enter a price like 99 or 149.50 (at least $1)." };
  const { error } = await createAdminClient().from("users").update({ monthly_price_cents: cents }).eq("id", userId);
  if (error) return { ok: false, error: "Couldn't save that." };
  revalidatePath("/admin");
  revalidatePath(`/admin/accounts/${userId}`);
  return { ok: true };
}

// A payment link to send a client, for a deal agreed outside the app.
export async function createCheckoutLink(userId: string): Promise<UrlResult> {
  await requireAdmin();
  if (!billingConfigured()) return { ok: false, error: "Add the Stripe keys first." };
  const owner = await loadOwner(userId);
  if (!owner) return { ok: false, error: "Account not found." };
  if (!owner.monthly_price_cents) return { ok: false, error: "Set a monthly price for this account first." };
  try {
    return { ok: true, url: await createCheckoutUrl(owner) };
  } catch (err) {
    console.error("Checkout link failed:", err instanceof Error ? err.message : "unknown error");
    return { ok: false, error: "Stripe couldn't create the link. Check the keys." };
  }
}

type Change = "extend" | "paying" | "pause" | "resume";

// Manual control over an account's access: for deals paid outside Stripe, and for exceptions.
export async function changeAccess(userId: string, change: Change): Promise<PlainResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: u } = await admin.from("users").select("trial_ends_at").eq("id", userId).maybeSingle();
  if (!u) return { ok: false, error: "Account not found." };
  const now = Date.now();
  const update =
    change === "extend"
      ? { subscription_status: "trialing", trial_ends_at: extendedEnd(u.trial_ends_at, now, 7), billing_issue_at: null }
      : change === "paying"
        ? { subscription_status: "active", trial_ends_at: null, billing_issue_at: null }
        : change === "pause"
          ? { subscription_status: "canceled" }
          : { subscription_status: "trialing", trial_ends_at: extendedEnd(null, now, 7), billing_issue_at: null };
  const { error } = await admin.from("users").update(update).eq("id", userId);
  if (error) return { ok: false, error: "Couldn't save that." };
  await logActivity(userId, "trial_changed");
  revalidatePath("/admin");
  revalidatePath(`/admin/accounts/${userId}`);
  return { ok: true };
}
