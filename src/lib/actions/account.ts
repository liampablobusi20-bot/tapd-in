"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInboxOwner } from "@/lib/inbox/require-owner";
import { logActivity } from "@/lib/inbox/activity-log";
import { isRetention, retentionLabel } from "@/lib/inbox/retention";

export type DeleteDataResult = { ok: true } | { ok: false; error: string };

// Everything Tapd In holds about the owner's messages, texts, people, and
// connections. Topics, their name, and the account itself are kept. Weekly-email
// records hold only a date, and are kept so a briefing isn't sent twice.
const TABLES = [
  "inbox_messages",
  "inbox_text_contacts",
  "inbox_text_names",
  "inbox_text_keys",
  "inbox_text_suggestions",
  "inbox_connections",
  // Settings tailored for this person can name other people, so they go too.
  "account_config",
  "account_config_history",
];

export async function deleteAllMyData(confirmation: string): Promise<DeleteDataResult> {
  const { user } = await requireInboxOwner();
  if (confirmation.trim().toUpperCase() !== "DELETE") return { ok: false, error: "Type DELETE to confirm." };

  const admin = createAdminClient();
  for (const table of TABLES) {
    const { error } = await admin.from(table).delete().eq("owner_id", user.id);
    if (error) return { ok: false, error: "Something went wrong, and some data may remain. Please try again." };
  }
  // A new forwarding address is made on the next visit, so the old one stops working.
  const { error } = await admin.from("users").update({ inbox_token: null }).eq("id", user.id);
  if (error) return { ok: false, error: "Something went wrong, and some data may remain. Please try again." };

  await logActivity(user.id, "data_deleted");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

// Whether to email the owner right away when something urgent arrives.
export async function setUrgentAlerts(on: boolean): Promise<DeleteDataResult> {
  const { user } = await requireInboxOwner();
  const { error } = await createAdminClient().from("users").update({ urgent_alerts: on }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save that. Please try again." };
  await logActivity(user.id, on ? "urgent_alerts_on" : "urgent_alerts_off");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// How long summaries are kept before they are deleted automatically.
export async function setRetention(days: number): Promise<DeleteDataResult> {
  const { user } = await requireInboxOwner();
  if (!isRetention(days)) return { ok: false, error: "Choose 90 days, 180 days, or 1 year." };
  const { error } = await createAdminClient().from("users").update({ retention_days: days }).eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save that. Please try again." };
  await logActivity(user.id, "retention_changed", retentionLabel(days));
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
