"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInboxOwner } from "@/lib/inbox/require-owner";

export type DeleteDataResult = { ok: true } | { ok: false; error: string };

// Everything Tapd In holds about the owner's messages, texts, people, and
// connections. Topics, their name, and the account itself are kept. Weekly-email
// records hold only a date, and are kept so a briefing isn't sent twice.
const TABLES = ["inbox_messages", "inbox_text_contacts", "inbox_text_names", "inbox_text_keys", "inbox_text_suggestions", "inbox_connections"];

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

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
