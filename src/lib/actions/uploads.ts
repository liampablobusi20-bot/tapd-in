"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGuestLink } from "@/lib/guest";

function mediaTypeFor(contentType: string): "image" | "video" | "file" {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return "file";
}

// Mints a Supabase Storage signed upload URL instead of accepting the file
// itself, so the actual bytes go straight from the browser to Supabase and
// never pass through this Server Action's request body — Vercel's Node.js
// functions hard-cap that body around 4.5MB regardless of Next.js config,
// which silently broke any real phone photo or video.
export async function createUploadUrl(
  calendarId: string,
  calendarItemId: string,
  filename: string,
  contentType: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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

  const path = `${calendarId}/${calendarItemId}/${crypto.randomUUID()}-${filename}`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("entry-photos")
    .createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Could not start upload.");

  return { path: data.path, token: data.token, mediaType: mediaTypeFor(contentType) };
}

export async function createGuestUploadUrl(
  token: string,
  calendarItemId: string,
  filename: string,
  contentType: string
) {
  const link = await resolveGuestLink(token);
  if (!link || link.permission !== "comment") {
    throw new Error("Not permitted.");
  }

  const admin = createAdminClient();
  const { data: item } = await admin
    .from("calendar_items")
    .select("id")
    .eq("id", calendarItemId)
    .eq("calendar_id", link.calendar_id)
    .maybeSingle();
  if (!item) throw new Error("Not found.");

  const path = `${link.calendar_id}/${calendarItemId}/${crypto.randomUUID()}-${filename}`;
  const { data, error } = await admin.storage
    .from("entry-photos")
    .createSignedUploadUrl(path);
  if (error || !data) throw new Error(error?.message ?? "Could not start upload.");

  return { path: data.path, token: data.token, mediaType: mediaTypeFor(contentType) };
}
