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

// RLS scopes every query below to calendars the signed-in Owner owns, so a
// calendar/group id that isn't theirs simply comes back empty.
export async function createGroup(calendarId: string, formData: FormData) {
  const { supabase } = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("id", calendarId)
    .maybeSingle();
  if (!calendar) throw new Error("Not found.");

  const { error } = await supabase
    .from("guest_groups")
    .insert({ calendar_id: calendarId, name: name.slice(0, 40) });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
}

export async function deleteGroup(groupId: string, calendarId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("guest_groups")
    .delete()
    .eq("id", groupId)
    .eq("calendar_id", calendarId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
}

export async function setLinkGroup(
  linkId: string,
  calendarId: string,
  groupId: string | null
) {
  const { supabase } = await requireUser();

  if (groupId) {
    const { data: group } = await supabase
      .from("guest_groups")
      .select("id")
      .eq("id", groupId)
      .eq("calendar_id", calendarId)
      .maybeSingle();
    if (!group) throw new Error("Not found.");
  }

  const { error } = await supabase
    .from("guest_links")
    .update({ group_id: groupId })
    .eq("id", linkId)
    .eq("calendar_id", calendarId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
}
