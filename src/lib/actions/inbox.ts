"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireInboxOwner } from "@/lib/inbox/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPending } from "@/lib/inbox/process";
import { syncOwnerMicrosoft } from "@/lib/inbox/microsoft-sync";
import { lastSevenDays } from "@/lib/inbox/digest";
import { sendDigest } from "@/lib/inbox/send-digest";

// The forwarding address is made on first visit and never changes.
export async function ensureInboxToken(): Promise<string> {
  const { supabase, user } = await requireInboxOwner();
  const { data } = await supabase.from("users").select("inbox_token").eq("id", user.id).single();
  if (data?.inbox_token) return data.inbox_token;

  const admin = createAdminClient();
  const token = randomBytes(15).toString("hex");
  const { error } = await admin
    .from("users")
    .update({ inbox_token: token })
    .eq("id", user.id)
    .is("inbox_token", null);
  if (error) throw new Error(error.message);
  const { data: again } = await supabase.from("users").select("inbox_token").eq("id", user.id).single();
  return again?.inbox_token ?? token;
}

export async function addCategory(formData: FormData) {
  const { supabase, user } = await requireInboxOwner();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const description = String(formData.get("description") ?? "").trim().slice(0, 300);
  if (!name) return;

  const { count } = await supabase
    .from("inbox_categories")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((count ?? 0) >= 20) throw new Error("That's the most categories you can have.");

  const { error } = await supabase.from("inbox_categories").insert({
    owner_id: user.id,
    name,
    description: description || null,
    sort_order: count ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export async function deleteCategory(id: string) {
  const { supabase, user } = await requireInboxOwner();
  const { error } = await supabase
    .from("inbox_categories")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

// "This isn't business" / clean-up: removes a message and its summary.
export async function deleteInboxMessage(id: string) {
  const { user } = await requireInboxOwner();
  const admin = createAdminClient();
  const { error } = await admin.from("inbox_messages").delete().eq("id", id).eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export async function updateName(formData: FormData) {
  const { supabase, user } = await requireInboxOwner();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const { error } = await supabase
    .from("users")
    .update({ display_name: name || null })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
}

export type TestDigestResult = { status: "sent" | "failed" } | undefined;

export async function sendTestDigest(): Promise<TestDigestResult> {
  const { user } = await requireInboxOwner();
  await syncOwnerMicrosoft(user.id);
  await processPending(20);
  const status = await sendDigest(user.id, lastSevenDays(Date.now()));
  return { status: status === "sent" ? "sent" : "failed" };
}

// "Done" on something waiting on the owner. It leaves the Waiting list but stays in the briefing.
export async function resolveWaiting(id: string) {
  const { user } = await requireInboxOwner();
  const { error } = await createAdminClient()
    .from("inbox_messages")
    .update({ resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

// "Got it": the owner has what was promised (or no longer needs it).
export async function markDelivered(id: string) {
  const { user } = await requireInboxOwner();
  const { error } = await createAdminClient()
    .from("inbox_messages")
    .update({ promise_resolved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
