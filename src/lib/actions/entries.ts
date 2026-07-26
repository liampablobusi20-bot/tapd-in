"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, calendars!inner(owner_id)")
    .eq("id", calendarItemId)
    .maybeSingle();

  const ownerId = (item?.calendars as unknown as { owner_id: string } | null)
    ?.owner_id;
  if (!item || ownerId !== user.id) {
    throw new Error("Not found.");
  }

  const bodyText = String(formData.get("body_text") ?? "").trim();
  const media = formData.get("media");
  const hasMedia = media instanceof File && media.size > 0;

  if (!bodyText && !hasMedia) return;

  let mediaUrl: string | null = null;
  let mediaType: "image" | "video" | null = null;

  if (hasMedia) {
    const file = media as File;
    mediaType = file.type.startsWith("video/") ? "video" : "image";
    const path = `${calendarId}/${calendarItemId}/${crypto.randomUUID()}-${file.name}`;

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
    author_type: "owner",
    author_label: user.email,
    body_text: bodyText || null,
    photo_url: mediaUrl,
    media_type: mediaType,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
}
