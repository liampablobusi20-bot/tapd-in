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
import { cleanReason, dayText, diffItem, type ItemSnapshot } from "@/lib/item-changes";
import { logChangeEntries } from "@/lib/change-log";
import { ownerLabel } from "@/lib/owner";

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
  const { supabase, user } = await requireUser();

  const { data: before } = await supabase
    .from("calendar_items")
    .select("label, target_date, start_time, status, notes")
    .eq("id", itemId)
    .maybeSingle();

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
    .select("label, target_date, start_time, status, notes, visible_group_ids");

  if (error) throw new Error(error.message);

  const updatedRow = updated?.[0];
  const audience = updatedRow?.visible_group_ids ?? null;
  const changes =
    before && updatedRow
      ? diffItem(before as ItemSnapshot, updatedRow as ItemSnapshot)
      : [];

  const threadLines = changes.filter((change) => change.thread);
  if (threadLines.length) {
    await logChangeEntries(
      supabase,
      threadLines.map((change) => ({
        itemId,
        text: change.thread!,
        visibleGroupIds: audience,
      })),
      await ownerLabel(supabase, user)
    );
  }

  revalidatePath(`/dashboard/calendars/${calendarId}`);
  if (changes.length) {
    const message = changes.map((change) => change.notify).join("; ");
    after(() => notifyGuestsOfChange(calendarId, message, undefined, audience));
  }
}

export async function deleteItem(itemId: string, calendarId: string) {
  const { supabase } = await requireUser();

  const { data: existing } = await supabase
    .from("calendar_items")
    .select("label, visible_group_ids")
    .eq("id", itemId)
    .maybeSingle();
  const audience = existing?.visible_group_ids ?? null;
  const removed = existing?.label ? `Removed "${existing.label}"` : "An item was removed.";

  const { error } = await supabase
    .from("calendar_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
  after(() => notifyGuestsOfChange(calendarId, removed, undefined, audience));
}

export type ShiftResult = { movedIds: string[]; days: number };

// One upsert statement, so the whole schedule shifts or none of it does —
// a half-shifted chain of items is worse than an error.
async function applyShift(
  supabase: Awaited<ReturnType<typeof createClient>>,
  calendarId: string,
  ids: string[],
  days: number,
  authorLabel: string,
  reason?: string | null
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

  const why = cleanReason(reason);
  const suffix = why ? ` — ${why}` : "";
  const moved = rows
    .map((row) => ({
      id: row.id as string,
      label: row.label as string,
      from: row.target_date as string,
      to: addDays(row.target_date as string, days),
      visible: row.visible_group_ids as string[] | null,
    }))
    .sort((a, b) => a.from.localeCompare(b.from));

  await logChangeEntries(
    supabase,
    moved.map((item) => ({
      itemId: item.id,
      text: `Moved from ${dayText(item.from)} to ${dayText(item.to)}${suffix}`,
      visibleGroupIds: item.visible,
    })),
    authorLabel
  );

  revalidatePath(`/dashboard/calendars/${calendarId}`);
  const first = moved[0];
  const size = Math.abs(days);
  const message =
    moved.length === 1
      ? `"${first.label}" moved from ${dayText(first.from)} to ${dayText(first.to)}${suffix}`
      : `${moved.length} items moved ${days > 0 ? "later" : "earlier"} by ${size} ${
          size === 1 ? "day" : "days"
        }, starting with "${first.label}" (${dayText(first.from)} → ${dayText(first.to)})${suffix}`;
  const audience = audienceForItems(rows);
  after(() => notifyGuestsOfChange(calendarId, message, undefined, audience));
  return { movedIds: rows.map((row) => row.id), days };
}

export async function shiftPhasesFrom(
  itemId: string,
  calendarId: string,
  days: number,
  reason?: string | null
): Promise<ShiftResult> {
  const { supabase, user } = await requireUser();
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
    days,
    await ownerLabel(supabase, user),
    reason
  );
}

export async function shiftPhasesByIds(
  calendarId: string,
  ids: string[],
  days: number,
  reason?: string | null
): Promise<ShiftResult> {
  const { supabase, user } = await requireUser();
  if (!isValidShiftDays(days) || ids.length > 500) {
    throw new Error("Invalid request.");
  }
  return applyShift(
    supabase,
    calendarId,
    ids,
    days,
    await ownerLabel(supabase, user),
    reason
  );
}
