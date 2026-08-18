"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGuestLink } from "@/lib/guest";
import { notifyGuestsOfChange } from "@/lib/notify";

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
    .select("id")
    .eq("id", calendarItemId)
    .eq("calendar_id", link.calendar_id)
    .maybeSingle();
  if (!item) throw new Error("Not found.");

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

  const { error } = await supabase.from("entries").insert({
    calendar_item_id: calendarItemId,
    author_type: "guest",
    author_label: authorLabel,
    body_text: bodyText || null,
    photo_url: mediaUrl,
    media_type: mediaType,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/c/${token}`);
  after(() =>
    notifyGuestsOfChange(link.calendar_id, `${authorLabel} posted an update.`, token)
  );
}
