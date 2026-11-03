"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminEmails, isAdmin } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { logActivity } from "@/lib/inbox/activity-log";

// Every admin action starts here. Anyone who isn't the administrator gets a 404.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) notFound();
  return user;
}

// Switches a person's inbox on or off, in place of running SQL by hand.
export async function setInboxEnabled(userId: string, enabled: boolean) {
  await requireAdmin();
  const { error } = await createAdminClient().from("users").update({ inbox_enabled: enabled }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
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
