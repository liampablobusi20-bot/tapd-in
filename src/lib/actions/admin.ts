"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminEmails, isAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/inbox/activity-log";
import { applyConfigPatch, revertConfig } from "@/lib/inbox/config-store";
import { newTrialEnd } from "@/lib/inbox/trial";

// Every admin action starts here. Anyone who isn't the administrator gets a 404.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) notFound();
  return user;
}

// Switches a person's inbox on or off, in place of running SQL by hand. Switching someone on
// for the first time starts their free trial. Someone who already has a trial, or is paying, keeps it.
export async function setInboxEnabled(userId: string, enabled: boolean) {
  await requireAdmin();
  const admin = createAdminClient();
  const update: Record<string, unknown> = { inbox_enabled: enabled };
  if (enabled) {
    const { data: u } = await admin.from("users").select("subscription_status, trial_ends_at").eq("id", userId).maybeSingle();
    if (u && u.subscription_status === "trialing" && !u.trial_ends_at) update.trial_ends_at = newTrialEnd(Date.now());
  }
  const { error } = await admin.from("users").update(update).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export type ConfigResult = { ok: true; changes: string[] } | { ok: false; errors: string[] };

const lines = (value: FormDataEntryValue | null) =>
  String(value ?? "")
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);

// Saves the settings form for one account. Only that account is touched.
export async function saveAccountConfig(userId: string, formData: FormData): Promise<ConfigResult> {
  const admin = await requireAdmin();
  const flag = (name: string) => formData.get(name) === "on";
  const patch = {
    triageNotes: String(formData.get("triageNotes") ?? ""),
    alwaysUrgent: lines(formData.get("alwaysUrgent")),
    ignoreSenders: lines(formData.get("ignoreSenders")),
    summaryStyle: String(formData.get("summaryStyle") ?? "normal"),
    urgentVipOnly: flag("urgentVipOnly"),
    quietFromHour: Number(formData.get("quietFromHour")),
    quietUntilHour: Number(formData.get("quietUntilHour")),
    features: {
      people: flag("feat_people"),
      meetingBriefs: flag("feat_meetingBriefs"),
      urgentAlerts: flag("feat_urgentAlerts"),
      texts: flag("feat_texts"),
      waitingOnYou: flag("feat_waitingOnYou"),
      owedToYou: flag("feat_owedToYou"),
    },
  };
  const result = await applyConfigPatch(userId, patch, admin.email ?? "admin", String(formData.get("note") ?? "").trim() || null);
  revalidatePath(`/admin/accounts/${userId}`);
  return result;
}

export async function revertAccountConfig(userId: string, historyId: string): Promise<ConfigResult> {
  const admin = await requireAdmin();
  const result = await revertConfig(userId, historyId, admin.email ?? "admin");
  revalidatePath(`/admin/accounts/${userId}`);
  return result;
}

// Proves the alert emails reach the administrator, without waiting for a real problem.
export async function sendTestAlert(): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const to = adminEmails();
  if (to.length === 0) return { ok: false, message: "ADMIN_EMAILS isn't set, so there is nowhere to send alerts." };
  const results = await Promise.all(
    to.map((address) => sendEmail(address, "Tapd In: test alert", "This is a test. If you can read this, Tapd In can email you when something goes wrong."))
  );
  return results.some(Boolean)
    ? { ok: true, message: `Sent to ${to.length === 1 ? "your admin address" : `${to.length} admin addresses`}. Check your inbox.` }
    : { ok: false, message: "The email couldn't be sent. Check the Resend settings." };
}

// For someone who has lost their phone: removes their two-step sign-in so they can log in
// with their password again and set it up fresh. Only do this after confirming it's really them.
export async function resetTwoStep(userId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
  if (error) throw new Error(error.message);
  for (const factor of data?.factors ?? []) {
    const { error: removeError } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    if (removeError) throw new Error(removeError.message);
  }
  await logActivity(userId, "two_step_reset");
  revalidatePath("/admin");
}
