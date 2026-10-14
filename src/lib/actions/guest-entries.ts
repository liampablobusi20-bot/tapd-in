"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVisibleToGuest, resolveGuestLink } from "@/lib/guest";
import { notifyGuestsOfChange } from "@/lib/notify";
import { snippet } from "@/lib/item-changes";

export async function addGuestEntry(
  token: string,
  calendarItemId: string,
  formData: FormData
) {
  const link = await resolveGuestLink(token);
  if (!link || link.permission !== "comment") {
    throw new Error("Not permitted.");
  }

  const supabase = createAdminClient();

  const { data: item } = await supabase
    .from("calendar_items")
    .select("id, label, visible_group_ids")
    .eq("id", calendarItemId)
    .eq("calendar_id", link.calendar_id)
    .maybeSingle();
  if (!item || !isVisibleToGuest(item.visible_group_ids, link.group_id)) {
    throw new Error("Not found.");
  }

  const bodyText = String(formData.get("body_text") ?? "").trim();
  const authorLabel =
    String(formData.get("author_name") ?? "").trim() || "Guest";
  const mediaUrl = String(formData.get("media_url") ?? "").trim() || null;
  const mediaTypeRaw = String(formData.get("media_type") ?? "").trim();
  const mediaType =
    mediaTypeRaw === "video" || mediaTypeRaw === "image" || mediaTypeRaw === "file"
      ? mediaTypeRaw
      : null;

  if (!bodyText && !mediaUrl) return;

  // A reply must answer a comment on this item that this guest can see.
  const replyToRaw = String(formData.get("reply_to") ?? "").trim() || null;
  let replyRootId: string | null = null;
  let replyParentAuthor: string | null = null;
  if (replyToRaw) {
    const { data: parent } = await supabase
      .from("entries")
      .select("id, reply_to, kind, author_label, visible_group_ids, calendar_item_id")
      .eq("id", replyToRaw)
      .maybeSingle();
    if (
      !parent ||
      parent.calendar_item_id !== calendarItemId ||
      parent.kind !== "note" ||
      !isVisibleToGuest(parent.visible_group_ids, link.group_id)
    ) {
      throw new Error("Not found.");
    }
    replyRootId = parent.reply_to ?? parent.id;
    replyParentAuthor = parent.author_label;
  }

  // A grouped guest's posts stay within their own group (plus the Owner), so
  // e.g. a sub's pricing comment can't leak to the client. Ungrouped guests
  // post to everyone, as before.
  const visibleGroupIds = link.group_id ? [link.group_id] : null;

  const { error } = await supabase.from("entries").insert({
    calendar_item_id: calendarItemId,
    author_type: "guest",
    author_label: authorLabel,
    body_text: bodyText || null,
    photo_url: mediaUrl,
    media_type: mediaType,
    visible_group_ids: visibleGroupIds,
    reply_to: replyRootId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/c/${token}`);
  const what = bodyText
    ? `"${snippet(bodyText)}"`
    : `shared a ${mediaType === "image" ? "photo" : (mediaType ?? "file")}`;
  const message = replyToRaw
    ? `${authorLabel} replied to ${replyParentAuthor ?? "a comment"} on "${item.label}": ${what}`
    : `${authorLabel} on "${item.label}": ${what}`;
  after(() => notifyGuestsOfChange(link.calendar_id, message, token, visibleGroupIds));
}
