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

export async function createItem(calendarId: string, targetDate?: string | null) {
  const { supabase } = await requireUser();

  const { count } = await supabase
    .from("calendar_items")
    .select("id", { count: "exact", head: true })
    .eq("calendar_id", calendarId);

  const { error } = await supabase.from("calendar_items").insert({
    calendar_id: calendarId,
    label: "New phase",
    target_date: targetDate ?? null,
    sort_order: count ?? 0,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
}

export async function updateItem(
  itemId: string,
  calendarId: string,
  fields: { label?: string; target_date?: string | null; notes?: string }
) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("calendar_items")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
}

export async function deleteItem(itemId: string, calendarId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("calendar_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
}
