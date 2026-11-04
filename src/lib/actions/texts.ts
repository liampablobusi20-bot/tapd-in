"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInboxOwner } from "@/lib/inbox/require-owner";
import { logActivity } from "@/lib/inbox/activity-log";
import { applyConfigPatch } from "@/lib/inbox/config-store";
import { parseContactList, type ImportSkip } from "@/lib/inbox/contact-import";
import { formatPhone, generateKey, normalizeHandle } from "@/lib/inbox/texts";
import { conversationKey, groupConversations } from "@/lib/inbox/conversations";
import { summarizeConversationNotes } from "@/lib/inbox/conversation-summary";

const MAX_CONTACTS = 500;
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
  await logActivity(user.id, "text_person_added");
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
  await logActivity(user.id, "text_person_removed");
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
  await logActivity(user.id, "phone_key_created");
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
  await logActivity(user.id, "phone_key_revoked");
  revalidatePath("/dashboard/settings");
}

export type ConversationResult = { summary: string; count: number } | { error: string };

// Combines the one-line notes already kept for a conversation into a short
// summary. Runs only when asked for, and uses the summaries, not the original texts.
export async function summarizeConversation(messageId: string): Promise<ConversationResult> {
  const { supabase, user } = await requireInboxOwner();

  const { data: start } = await supabase
    .from("inbox_messages")
    .select("id, source, sender_name, sender_address, received_at")
    .eq("id", messageId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!start || start.source !== "sms") return { error: "Conversations are available for texts." };

  const center = Date.parse(start.received_at);
  const { data: rows } = await supabase
    .from("inbox_messages")
    .select("id, sender_name, sender_address, received_at, summary")
    .eq("owner_id", user.id)
    .eq("source", "sms")
    .eq("status", "processed")
    .gte("received_at", new Date(center - 2 * 86_400_000).toISOString())
    .lte("received_at", new Date(center + 2 * 86_400_000).toISOString())
    .limit(300);

  const same = (rows ?? []).filter((r) => conversationKey(r) === conversationKey(start) && r.summary);
  const ids = groupConversations(same).get(start.id) ?? [start.id];
  const members = same
    .filter((r) => ids.includes(r.id))
    .sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at))
    .slice(-30);
  if (members.length < 2) return { error: "There's only one text in this conversation." };

  const notes = members.map((r) => ({
    at: new Date(r.received_at).toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/Phoenix",
    }),
    summary: r.summary as string,
  }));
  const summary = await summarizeConversationNotes(new Anthropic(), start.sender_name ?? "this person", notes);
  return summary ? { summary, count: members.length } : { error: "Couldn't summarize that. Try again." };
}

// Gives a phone number a name. Every text already received from that number is
// relabeled, and future ones use the name.
export async function nameTextNumber(handleRaw: string, nameRaw: string) {
  const { supabase, user } = await requireInboxOwner();
  const handle = normalizeHandle(handleRaw);
  const name = nameRaw.trim().slice(0, 80);
  if (!handle || !name) throw new Error("Add a name.");

  const { error } = await supabase
    .from("inbox_text_contacts")
    .upsert({ owner_id: user.id, handle, name }, { onConflict: "owner_id,handle" });
  if (error) throw new Error(error.message);

  await createAdminClient()
    .from("inbox_messages")
    .update({ sender_name: name })
    .eq("owner_id", user.id)
    .eq("source", "sms")
    .eq("sender_address", handle);
  revalidatePath("/dashboard");
}

export async function setTextSuggestions(on: boolean) {
  const { supabase, user } = await requireInboxOwner();
  const { error } = await supabase.from("users").update({ text_suggestions: on }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

// Add: the number joins the list under a name. Ignore: it stops being suggested.
export async function resolveSuggestion(id: string, action: "add" | "ignore", name?: string) {
  const { supabase, user } = await requireInboxOwner();
  const { data: suggestion } = await supabase
    .from("inbox_text_suggestions")
    .select("id, handle")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!suggestion) throw new Error("Not found.");

  if (action === "add") {
    const clean = (name ?? "").trim().slice(0, 80);
    if (!clean) throw new Error("Add a name.");
    const { error } = await supabase
      .from("inbox_text_contacts")
      .upsert({ owner_id: user.id, handle: suggestion.handle, name: clean }, { onConflict: "owner_id,handle" });
    if (error) throw new Error(error.message);
    await supabase.from("inbox_text_suggestions").delete().eq("id", id).eq("owner_id", user.id);
  } else {
    await supabase.from("inbox_text_suggestions").update({ status: "ignored" }).eq("id", id).eq("owner_id", user.id);
  }
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

export type ModeResult = { ok: true } | { ok: false; error: string };

// Chooses how texts reach Tapd In. Easy mode means the phone sends every text and Tapd In keeps only
// the people on the list, so it needs the owner's explicit agreement, which is recorded.
export async function setTextsMode(mode: "private" | "easy", agreed: boolean): Promise<ModeResult> {
  const { user } = await requireInboxOwner();
  if (mode === "easy" && !agreed) return { ok: false, error: "Please tick the box to confirm you understand." };
  const result = await applyConfigPatch(user.id, { textsMode: mode }, "customer", mode === "easy" ? "Agreed to easy mode" : "Back to private mode", { log: false });
  if (!result.ok) return { ok: false, error: "Couldn't save that. Please try again." };
  if (result.changes.length > 0) await logActivity(user.id, mode === "easy" ? "texts_easy_on" : "texts_easy_off");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/settings/phone");
  return { ok: true };
}

export type ImportPreview =
  | {
      ok: true;
      toAdd: number;
      alreadyOnList: number;
      duplicates: number;
      skipped: ImportSkip[];
      sample: { name: string; number: string }[];
    }
  | { ok: false; error: string };

// Which of these numbers are already on the list, so a second paste doesn't double anyone.
async function existingHandles(ownerId: string, handles: string[]): Promise<Set<string>> {
  const supabase = createAdminClient();
  const found = new Set<string>();
  for (let i = 0; i < handles.length; i += 100) {
    const { data } = await supabase
      .from("inbox_text_contacts")
      .select("handle")
      .eq("owner_id", ownerId)
      .in("handle", handles.slice(i, i + 100));
    for (const row of data ?? []) found.add(row.handle);
  }
  return found;
}

// Shows what pasting a list would do, without changing anything.
export async function previewContactImport(text: string): Promise<ImportPreview> {
  const { user } = await requireInboxOwner();
  const parsed = parseContactList(text.slice(0, 200_000));
  if (parsed.tooMany) return { ok: false, error: "That's more than 500 people at once. Please paste them in smaller groups." };
  if (parsed.entries.length === 0) {
    return { ok: false, error: parsed.skipped.length ? "Couldn't find a phone number or email on any line." : "Paste some people first, one per line." };
  }
  const existing = await existingHandles(user.id, parsed.entries.map((e) => e.handle));
  const fresh = parsed.entries.filter((e) => !existing.has(e.handle));
  return {
    ok: true,
    toAdd: fresh.length,
    alreadyOnList: parsed.entries.length - fresh.length,
    duplicates: parsed.duplicates,
    skipped: parsed.skipped.slice(0, 5),
    sample: fresh.slice(0, 5).map((e) => ({ name: e.name, number: formatPhone(e.handle) })),
  };
}

export type ImportResult = { ok: true; added: number; alreadyOnList: number } | { ok: false; error: string };

// Adds everyone in the pasted list. People already on the list keep their existing names.
export async function importContacts(text: string): Promise<ImportResult> {
  const { supabase, user } = await requireInboxOwner();
  const parsed = parseContactList(text.slice(0, 200_000));
  if (parsed.tooMany) return { ok: false, error: "That's more than 500 people at once. Please paste them in smaller groups." };
  const existing = await existingHandles(user.id, parsed.entries.map((e) => e.handle));
  const fresh = parsed.entries.filter((e) => !existing.has(e.handle));
  if (fresh.length === 0) return { ok: true, added: 0, alreadyOnList: parsed.entries.length };

  const { count } = await supabase.from("inbox_text_contacts").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
  if ((count ?? 0) + fresh.length > MAX_CONTACTS) {
    return { ok: false, error: `Your list can hold ${MAX_CONTACTS} people and has ${count ?? 0}. This would add ${fresh.length}.` };
  }
  for (let i = 0; i < fresh.length; i += 200) {
    const { error } = await supabase
      .from("inbox_text_contacts")
      .upsert(fresh.slice(i, i + 200).map((e) => ({ owner_id: user.id, name: e.name, handle: e.handle })), { onConflict: "owner_id,handle", ignoreDuplicates: true });
    if (error) return { ok: false, error: "Something went wrong, and some people may not have been added. Please try again." };
  }
  await logActivity(user.id, "text_people_imported", `${fresh.length} people`);
  revalidatePath("/dashboard/settings");
  return { ok: true, added: fresh.length, alreadyOnList: parsed.entries.length - fresh.length };
}

// For a sales list that has run its course, or a paste that went wrong.
export async function removeAllContacts(): Promise<ModeResult> {
  const { supabase, user } = await requireInboxOwner();
  const { error } = await supabase.from("inbox_text_contacts").delete().eq("owner_id", user.id);
  if (error) return { ok: false, error: "Couldn't clear the list. Please try again." };
  await logActivity(user.id, "text_people_cleared");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
