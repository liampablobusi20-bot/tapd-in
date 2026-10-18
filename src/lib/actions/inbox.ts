"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestMessage, processPending } from "@/lib/inbox/process";
import { lastSevenDays } from "@/lib/inbox/digest";
import { sendDigest } from "@/lib/inbox/send-digest";

// Every inbox action starts here: a signed-in owner whose inbox is switched on.
async function requireInboxOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users")
    .select("inbox_enabled")
    .eq("id", user.id)
    .single();
  if (!profile?.inbox_enabled) redirect("/dashboard");
  return { supabase, user };
}

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
  revalidatePath("/dashboard/inbox");
}

export async function deleteCategory(id: string) {
  const { supabase, user } = await requireInboxOwner();
  const { error } = await supabase
    .from("inbox_categories")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/inbox");
}

// "This isn't business" / clean-up: removes a message and its summary.
export async function deleteInboxMessage(id: string) {
  const { user } = await requireInboxOwner();
  const admin = createAdminClient();
  const { error } = await admin.from("inbox_messages").delete().eq("id", id).eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/inbox");
}

// Lets an owner try the sorting by pasting a message, without waiting for mail.
export async function addSampleMessage(formData: FormData) {
  const { user } = await requireInboxOwner();
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);
  if (!body) return;
  const senderName = String(formData.get("sender") ?? "").trim().slice(0, 80) || "Test sender";
  const subject = String(formData.get("subject") ?? "").trim().slice(0, 200) || null;

  const admin = createAdminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from("inbox_messages")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .like("external_id", "manual-%")
    .gte("created_at", since);
  if ((count ?? 0) >= 30) throw new Error("That's enough test messages for today.");

  await ingestMessage(user.id, `manual-${randomUUID()}`, {
    source: "forward",
    senderName,
    senderAddress: null,
    subject,
    body,
    receivedAt: new Date().toISOString(),
  });
  await processPending(5);
  revalidatePath("/dashboard/inbox");
}

export type TestDigestResult = { status: "sent" | "failed" } | undefined;

export async function sendTestDigest(): Promise<TestDigestResult> {
  const { user } = await requireInboxOwner();
  await processPending(20);
  const status = await sendDigest(user.id, lastSevenDays(Date.now()));
  return { status: status === "sent" ? "sent" : "failed" };
}
