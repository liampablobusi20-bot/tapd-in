"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInboxOwner } from "@/lib/inbox/require-owner";
import { generateKey, normalizeHandle } from "@/lib/inbox/texts";

const MAX_CONTACTS = 100;
const MAX_KEYS = 5;

export async function addTextContact(formData: FormData) {
  const { supabase, user } = await requireInboxOwner();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const handle = normalizeHandle(String(formData.get("handle") ?? ""));
  if (!name) throw new Error("Add a name.");
  if (!handle) throw new Error("That doesn't look like a phone number or email.");

  const { count } = await supabase
    .from("inbox_text_contacts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((count ?? 0) >= MAX_CONTACTS) throw new Error("That's the most contacts you can add.");

  const { error } = await supabase
    .from("inbox_text_contacts")
    .upsert({ owner_id: user.id, name, handle }, { onConflict: "owner_id,handle" });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
}

export async function removeTextContact(id: string) {
  const { supabase, user } = await requireInboxOwner();
  const { error } = await supabase
    .from("inbox_text_contacts")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
}

// Makes a device key. The key itself is returned once and never stored, only its hash.
export async function createTextKey(): Promise<string> {
  const { supabase, user } = await requireInboxOwner();
  const { count } = await supabase
    .from("inbox_text_keys")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_KEYS) throw new Error("Remove an old key before making a new one.");

  const { key, hash, prefix } = generateKey();
  const { error } = await createAdminClient()
    .from("inbox_text_keys")
    .insert({ owner_id: user.id, key_hash: hash, key_prefix: prefix });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
  return key;
}

export async function revokeTextKey(id: string) {
  const { user } = await requireInboxOwner();
  const { error } = await createAdminClient()
    .from("inbox_text_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
}
