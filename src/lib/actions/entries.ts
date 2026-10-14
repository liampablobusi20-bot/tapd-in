"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyGuestsOfChange } from "@/lib/notify";
import { snippet } from "@/lib/item-changes";
import { ownerLabel } from "@/lib/owner";
import { canDeleteEntry, validateEntryEdit } from "@/lib/entry-edit";
import { removeEntryMedia } from "@/lib/media-urls";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createEntry(
  calendarItemId: string,
  calendarId: string,
  formData: FormData
) {
  const { supabase, user } = await requireUser();

  // Confirm this calendar item belongs to a calendar the current user owns
  // before touching storage or the entries table.
  const { data: item } = await supabase
    .from("calendar_items")
    .select("id, label, calendars!inner(owner_id)")
    .eq("id", calendarItemId)
    .maybeSingle();

  const ownerId = (item?.calendars as unknown as { owner_id: string } | null)
    ?.owner_id;
  if (!item || ownerId !== user.id) {
    throw new Error("Not found.");
  }

  const bodyText = String(formData.get("body_text") ?? "").trim();
  const mediaUrl = String(formData.get("media_url") ?? "").trim() || null;
  const mediaTypeRaw = String(formData.get("media_type") ?? "").trim();
  const mediaType =
    mediaTypeRaw === "video" || mediaTypeRaw === "image" || mediaTypeRaw === "file"
      ? mediaTypeRaw
      : null;

  if (!bodyText && !mediaUrl) return;

  // A reply points at one comment on this same item. It stays under that
  // comment (replies to a reply attach to the original), and is visible to
  // exactly the people who can see the comment it answers.
  const replyToRaw = String(formData.get("reply_to") ?? "").trim() || null;
  let replyRootId: string | null = null;
  let replyParentAuthor: string | null = null;
  let replyAudience: string[] | null = null;
  if (replyToRaw) {
    const { data: parent } = await supabase
      .from("entries")
      .select("id, reply_to, kind, author_label, visible_group_ids, calendar_item_id")
      .eq("id", replyToRaw)
      .maybeSingle();
    if (!parent || parent.calendar_item_id !== calendarItemId || parent.kind !== "note") {
      throw new Error("Not found.");
    }
    replyRootId = parent.reply_to ?? parent.id;
    replyParentAuthor = parent.author_label;
    replyAudience = (parent.visible_group_ids as string[] | null) ?? null;
  }

  // No group ids = visible to everyone. Otherwise every id must be a group on
  // this calendar, so a tampered form can't point at someone else's group.
  const requestedGroupIds = [
    ...new Set(formData.getAll("visible_group_ids").map(String).filter(Boolean)),
  ];
  let visibleGroupIds: string[] | null = replyToRaw ? replyAudience : null;
  if (!replyToRaw && requestedGroupIds.length) {
    const { data: groups } = await supabase
      .from("guest_groups")
      .select("id")
      .eq("calendar_id", calendarId)
      .in("id", requestedGroupIds);
    if (groups?.length !== requestedGroupIds.length) {
      throw new Error("Not found.");
    }
    visibleGroupIds = requestedGroupIds;
  }

  const authorLabel = await ownerLabel(supabase, user);
  const { error } = await supabase.from("entries").insert({
    calendar_item_id: calendarItemId,
    author_type: "owner",
    author_label: authorLabel,
    body_text: bodyText || null,
    photo_url: mediaUrl,
    media_type: mediaType,
    visible_group_ids: visibleGroupIds,
    reply_to: replyRootId,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
  const what = bodyText
    ? `"${snippet(bodyText)}"`
    : `shared a ${mediaType === "image" ? "photo" : (mediaType ?? "file")}`;
  const message = replyToRaw
    ? `${authorLabel} replied to ${replyParentAuthor ?? "a comment"} on "${item.label}": ${what}`
    : `${authorLabel} on "${item.label}": ${what}`;
  after(() => notifyGuestsOfChange(calendarId, message, undefined, visibleGroupIds));
}

async function loadOwnedEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entryId: string,
  calendarId: string
) {
  // RLS limits this to entries on the signed-in owner's own calendars.
  const { data: entry } = await supabase
    .from("entries")
    .select("id, author_type, kind, photo_url, calendar_items!inner(calendar_id)")
    .eq("id", entryId)
    .maybeSingle();
  const entryCalendarId = (
    entry?.calendar_items as unknown as { calendar_id: string } | null
  )?.calendar_id;
  if (!entry || entryCalendarId !== calendarId) throw new Error("Not found.");
  return entry;
}

export async function updateEntry(
  entryId: string,
  calendarId: string,
  fields: { body_text?: string; visible_group_ids?: string[] | null }
) {
  const { supabase } = await requireUser();
  const entry = await loadOwnedEntry(supabase, entryId, calendarId);

  const result = validateEntryEdit(
    {
      author_type: entry.author_type as "owner" | "guest",
      kind: entry.kind as "note" | "change",
      photo_url: entry.photo_url,
    },
    fields
  );
  if (!result.ok) throw new Error(result.error);

  const groupIds = result.update.visible_group_ids;
  if (groupIds?.length) {
    const { data: groups } = await supabase
      .from("guest_groups")
      .select("id")
      .eq("calendar_id", calendarId)
      .in("id", groupIds);
    if (groups?.length !== groupIds.length) throw new Error("Not found.");
  }

  const { error } = await supabase.from("entries").update(result.update).eq("id", entryId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
}

export async function deleteEntry(entryId: string, calendarId: string) {
  const { supabase } = await requireUser();
  const entry = await loadOwnedEntry(supabase, entryId, calendarId);
  if (!canDeleteEntry({ kind: entry.kind as "note" | "change" })) {
    throw new Error("Schedule history can't be deleted.");
  }

  // Replies are deleted along with their comment, so their files go too.
  const { data: replies } = await supabase
    .from("entries")
    .select("photo_url")
    .eq("reply_to", entryId);

  const { error } = await supabase.from("entries").delete().eq("id", entryId);
  if (error) throw new Error(error.message);

  await removeEntryMedia(entry.photo_url);
  for (const reply of replies ?? []) await removeEntryMedia(reply.photo_url);
  revalidatePath(`/dashboard/calendars/${calendarId}`);
}
