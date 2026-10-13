"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { audienceForItems, notifyGuestsOfChange } from "@/lib/notify";
import { MAX_PROPOSALS, parseProposal } from "@/lib/assistant/proposals";
import { shiftPhasesFrom } from "@/lib/actions/calendar-items";

export type ApplyResult = { ok: boolean; message: string };

// Runs changes the owner just approved. The proposals come back from the
// browser, so every one is validated again from scratch and every database
// call runs through the owner's own session (RLS).
export async function applyAssistantProposals(
  calendarId: string,
  raw: unknown
): Promise<ApplyResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_PROPOSALS) {
    throw new Error("Invalid request.");
  }

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("id", calendarId)
    .maybeSingle();
  if (!calendar) throw new Error("Not found.");

  const { data: existing } = await supabase
    .from("calendar_items")
    .select("id, visible_group_ids")
    .eq("calendar_id", calendarId);
  const existingIds = new Set((existing ?? []).map((item) => item.id));
  const currentAudience = new Map(
    (existing ?? []).map((item) => [item.id, item.visible_group_ids as string[] | null])
  );
  let nextSortOrder = existingIds.size;
  // Who each direct change affects, so one notification reaches only the
  // guests who can see at least one changed item.
  const touched: { visible_group_ids: string[] | null }[] = [];

  // Every group a proposal names must exist on this calendar.
  async function groupsExist(ids: string[] | null | undefined) {
    if (!ids?.length) return true;
    const { data } = await supabase
      .from("guest_groups")
      .select("id")
      .eq("calendar_id", calendarId)
      .in("id", ids);
    return data?.length === ids.length;
  }
  let changedDirectly = false;

  const results: ApplyResult[] = [];
  for (const entry of raw) {
    const parsed = parseProposal(entry);
    if ("error" in parsed) {
      results.push({ ok: false, message: parsed.error });
      continue;
    }
    const proposal = parsed.proposal;

    try {
      if (proposal.type === "create_item") {
        if (!(await groupsExist(proposal.group_ids))) {
          results.push({ ok: false, message: "One of those groups no longer exists." });
          continue;
        }
        const { error } = await supabase.from("calendar_items").insert({
          calendar_id: calendarId,
          label: proposal.label,
          target_date: proposal.date,
          start_time: proposal.time,
          notes: proposal.notes,
          status: proposal.status,
          visible_group_ids: proposal.group_ids,
          sort_order: nextSortOrder++,
        });
        if (error) throw new Error(error.message);
        changedDirectly = true;
        touched.push({ visible_group_ids: proposal.group_ids });
        results.push({ ok: true, message: `Added "${proposal.label}"` });
      } else if (proposal.type === "update_item") {
        if (!existingIds.has(proposal.id)) {
          results.push({ ok: false, message: "That item no longer exists." });
          continue;
        }
        if (!(await groupsExist(proposal.group_ids))) {
          results.push({ ok: false, message: "One of those groups no longer exists." });
          continue;
        }
        const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (proposal.group_ids !== undefined) fields.visible_group_ids = proposal.group_ids;
        if (proposal.label !== undefined) fields.label = proposal.label;
        if (proposal.date !== undefined) fields.target_date = proposal.date;
        if (proposal.time !== undefined) fields.start_time = proposal.time;
        if (proposal.notes !== undefined) fields.notes = proposal.notes;
        if (proposal.status !== undefined) fields.status = proposal.status;
        const { error } = await supabase
          .from("calendar_items")
          .update(fields)
          .eq("id", proposal.id)
          .eq("calendar_id", calendarId);
        if (error) throw new Error(error.message);
        changedDirectly = true;
        touched.push({
          visible_group_ids:
            proposal.group_ids !== undefined
              ? proposal.group_ids
              : (currentAudience.get(proposal.id) ?? null),
        });
        results.push({ ok: true, message: "Updated an item" });
      } else if (proposal.type === "add_note") {
        if (!existingIds.has(proposal.item_id)) {
          results.push({ ok: false, message: "That item no longer exists." });
          continue;
        }
        if (proposal.group_ids) {
          const { data: groups } = await supabase
            .from("guest_groups")
            .select("id")
            .eq("calendar_id", calendarId)
            .in("id", proposal.group_ids);
          if (groups?.length !== proposal.group_ids.length) {
            results.push({ ok: false, message: "One of those groups no longer exists." });
            continue;
          }
        }
        const { error } = await supabase.from("entries").insert({
          calendar_item_id: proposal.item_id,
          author_type: "owner",
          author_label: user.email,
          body_text: proposal.text,
          visible_group_ids: proposal.group_ids,
        });
        if (error) throw new Error(error.message);
        const groupIds = proposal.group_ids;
        after(() =>
          notifyGuestsOfChange(calendarId, "A new update was posted.", undefined, groupIds)
        );
        results.push({
          ok: true,
          message: groupIds ? "Posted a note to the chosen groups" : "Posted a note to everyone",
        });
      } else if (proposal.type === "assign_guest_group") {
        if (proposal.group_id) {
          const { data: group } = await supabase
            .from("guest_groups")
            .select("id")
            .eq("id", proposal.group_id)
            .eq("calendar_id", calendarId)
            .maybeSingle();
          if (!group) {
            results.push({ ok: false, message: "That group no longer exists." });
            continue;
          }
        }
        const { data: updated, error } = await supabase
          .from("guest_links")
          .update({ group_id: proposal.group_id })
          .eq("id", proposal.guest_id)
          .eq("calendar_id", calendarId)
          .select("id");
        if (error) throw new Error(error.message);
        if (!updated?.length) {
          results.push({ ok: false, message: "That guest no longer exists." });
          continue;
        }
        results.push({ ok: true, message: "Updated a guest's group" });
      } else {
        const shifted = await shiftPhasesFrom(
          proposal.from_item_id,
          calendarId,
          proposal.days
        );
        results.push({
          ok: true,
          message: `Moved ${shifted.movedIds.length} ${
            shifted.movedIds.length === 1 ? "item" : "items"
          }`,
        });
      }
    } catch (error) {
      results.push({
        ok: false,
        message: error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }

  revalidatePath(`/dashboard/calendars/${calendarId}`);
  if (changedDirectly) {
    const audience = audienceForItems(touched);
    after(() =>
      notifyGuestsOfChange(calendarId, "The schedule was updated.", undefined, audience)
    );
  }
  return results;
}
