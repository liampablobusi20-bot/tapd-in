"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGuestLink } from "@/lib/guest";

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
  const media = formData.get("media");
  const hasMedia = media instanceof File && media.size > 0;

  if (!bodyText && !hasMedia) return;

  let mediaUrl: string | null = null;
  let mediaType: "image" | "video" | null = null;

  if (hasMedia) {
    const file = media as File;
    mediaType = file.type.startsWith("video/") ? "video" : "image";
    const path = `${link.calendar_id}/${calendarItemId}/${crypto.randomUUID()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("entry-photos")
      .upload(path, file, { contentType: file.type });
    if (uploadError) throw new Error(uploadError.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from("entry-photos").getPublicUrl(path);
    mediaUrl = publicUrl;
  }

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
}
