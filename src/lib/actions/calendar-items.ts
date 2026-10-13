"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { audienceForItems, notifyGuestsOfChange } from "@/lib/notify";
import {
  addDays,
  isValidShiftDays,
  selectPhasesToShift,
} from "@/lib/shift-phases";

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
    label: "New item",
    target_date: targetDate ?? null,
    sort_order: count ?? 0,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
  after(() => notifyGuestsOfChange(calendarId, "A new item was added."));
}

export type PhaseStatus = "scheduled" | "in_progress" | "done" | "delayed";

export async function updateItem(
  itemId: string,
  calendarId: string,
  fields: {
    label?: string;
    target_date?: string | null;
    start_time?: string | null;
    notes?: string;
    status?: PhaseStatus;
    // null (or empty) = visible to everyone; otherwise only these groups.
    visible_group_ids?: string[] | null;
  }
) {
  const { supabase } = await requireUser();

  const update: Record<string, unknown> = {
    ...fields,
    updated_at: new Date().toISOString(),
  };

  if (fields.visible_group_ids !== undefined) {
    const ids = [...new Set(fields.visible_group_ids ?? [])];
    if (ids.length) {
      // Every id must be a group on this calendar (RLS limits the lookup to
      // the owner's own calendars).
      const { data: groups } = await supabase
        .from("guest_groups")
        .select("id")
        .eq("calendar_id", calendarId)
        .in("id", ids);
      if (groups?.length !== ids.length) throw new Error("Not found.");
    }
    update.visible_group_ids = ids.length ? ids : null;
  }

  const { data: updated, error } = await supabase
    .from("calendar_items")
    .update(update)
    .eq("id", itemId)
    .select("visible_group_ids");

  if (error) throw new Error(error.message);

  const audience = updated?.[0]?.visible_group_ids ?? null;
  revalidatePath(`/dashboard/calendars/${calendarId}`);
  after(() => notifyGuestsOfChange(calendarId, "An item was updated.", undefined, audience));
}

export async function deleteItem(itemId: string, calendarId: string) {
  const { supabase } = await requireUser();

  const { data: existing } = await supabase
    .from("calendar_items")
    .select("visible_group_ids")
    .eq("id", itemId)
    .maybeSingle();
  const audience = existing?.visible_group_ids ?? null;

  const { error } = await supabase
    .from("calendar_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
  after(() => notifyGuestsOfChange(calendarId, "An item was removed.", undefined, audience));
}

export type ShiftResult = { movedIds: string[]; days: number };

// One upsert statement, so the whole schedule shifts or none of it does —
// a half-shifted chain of items is worse than an error.
async function applyShift(
  supabase: Awaited<ReturnType<typeof createClient>>,
  calendarId: string,
  ids: string[],
  days: number
): Promise<ShiftResult> {
  if (!ids.length) return { movedIds: [], days };

  const { data: rows, error } = await supabase
    .from("calendar_items")
    .select("id, calendar_id, label, notes, status, sort_order, target_date, visible_group_ids")
    .eq("calendar_id", calendarId)
    .in("id", ids)
    .not("target_date", "is", null);
  if (error) throw new Error(error.message);
  if (!rows?.length) return { movedIds: [], days };

  const now = new Date().toISOString();
  const { error: upsertError } = await supabase.from("calendar_items").upsert(
    rows.map((row) => ({
      ...row,
      target_date: addDays(row.target_date as string, days),
      updated_at: now,
    })),
    { onConflict: "id" }
  );
  if (upsertError) throw new Error(upsertError.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
  const count = rows.length;
  const audience = audienceForItems(rows);
  after(() =>
    notifyGuestsOfChange(
      calendarId,
      `${count} ${count === 1 ? "item was" : "items were"} rescheduled.`,
      undefined,
      audience
    )
  );
  return { movedIds: rows.map((row) => row.id), days };
}

export async function shiftPhasesFrom(
  itemId: string,
  calendarId: string,
  days: number
): Promise<ShiftResult> {
  const { supabase } = await requireUser();
  if (!isValidShiftDays(days)) throw new Error("Invalid number of days.");

  const { data: phases, error } = await supabase
    .from("calendar_items")
    .select("id, target_date, start_time, sort_order")
    .eq("calendar_id", calendarId)
    .not("target_date", "is", null);
  if (error) throw new Error(error.message);

  const anchor = phases?.find((phase) => phase.id === itemId);
  if (!anchor) throw new Error("Not found.");

  return applyShift(
    supabase,
    calendarId,
    selectPhasesToShift(anchor, phases ?? []),
    days
  );
}

export async function shiftPhasesByIds(
  calendarId: string,
  ids: string[],
  days: number
): Promise<ShiftResult> {
  const { supabase } = await requireUser();
  if (!isValidShiftDays(days) || ids.length > 500) {
    throw new Error("Invalid request.");
  }
  return applyShift(supabase, calendarId, ids, days);
}
