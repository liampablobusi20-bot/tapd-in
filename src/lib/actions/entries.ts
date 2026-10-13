"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyGuestsOfChange } from "@/lib/notify";

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
  const mediaUrl = String(formData.get("media_url") ?? "").trim() || null;
  const mediaTypeRaw = String(formData.get("media_type") ?? "").trim();
  const mediaType =
    mediaTypeRaw === "video" || mediaTypeRaw === "image" || mediaTypeRaw === "file"
      ? mediaTypeRaw
      : null;

  if (!bodyText && !mediaUrl) return;

  // No group ids = visible to everyone. Otherwise every id must be a group on
  // this calendar, so a tampered form can't point at someone else's group.
  const requestedGroupIds = [
    ...new Set(formData.getAll("visible_group_ids").map(String).filter(Boolean)),
  ];
  let visibleGroupIds: string[] | null = null;
  if (requestedGroupIds.length) {
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

  const { error } = await supabase.from("entries").insert({
    calendar_item_id: calendarItemId,
    author_type: "owner",
    author_label: user.email,
    body_text: bodyText || null,
    photo_url: mediaUrl,
    media_type: mediaType,
    visible_group_ids: visibleGroupIds,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
  after(() =>
    notifyGuestsOfChange(
      calendarId,
      "A new update was posted.",
      undefined,
      visibleGroupIds
    )
  );
}
