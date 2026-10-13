"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyGuestsOfChange } from "@/lib/notify";
import { dayText, diffItem, snippet, type ItemSnapshot } from "@/lib/item-changes";
import { logChangeEntries } from "@/lib/change-log";
import { ownerLabel } from "@/lib/owner";
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
    .select("id, label, target_date, start_time, status, notes, visible_group_ids")
    .eq("calendar_id", calendarId);
  const existingIds = new Set((existing ?? []).map((item) => item.id));
  const known = new Map(
    (existing ?? []).map((item) => [
      item.id as string,
      {
        snapshot: {
          label: item.label,
          target_date: item.target_date,
          start_time: item.start_time,
          status: item.status,
          notes: item.notes,
        } as ItemSnapshot,
        audience: item.visible_group_ids as string[] | null,
      },
    ])
  );
  let nextSortOrder = existingIds.size;
  const authorLabel = await ownerLabel(supabase, user);
  // What to tell guests, with who may hear it. Queued together, so a batch of
  // approved changes goes out as one message.
  const notices: { message: string; audience: string[] | null }[] = [];

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
        notices.push({
          message: `Added "${proposal.label}"${proposal.date ? ` (${dayText(proposal.date)})` : ""}`,
          audience: proposal.group_ids,
        });
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

        const current = known.get(proposal.id)!;
        const nextSnapshot: ItemSnapshot = {
          label: proposal.label ?? current.snapshot.label,
          target_date:
            proposal.date !== undefined ? proposal.date : current.snapshot.target_date,
          start_time:
            proposal.time !== undefined ? proposal.time : current.snapshot.start_time,
          status: proposal.status ?? current.snapshot.status,
          notes: proposal.notes !== undefined ? proposal.notes : current.snapshot.notes,
        };
        const nextAudience =
          proposal.group_ids !== undefined ? proposal.group_ids : current.audience;
        const changes = diffItem(current.snapshot, nextSnapshot);
        await logChangeEntries(
          supabase,
          changes
            .filter((change) => change.thread)
            .map((change) => ({
              itemId: proposal.id,
              text: change.thread!,
              visibleGroupIds: nextAudience,
            })),
          authorLabel
        );
        for (const change of changes) {
          notices.push({ message: change.notify, audience: nextAudience });
        }
        known.set(proposal.id, { snapshot: nextSnapshot, audience: nextAudience });
        results.push({ ok: true, message: `Updated "${nextSnapshot.label}"` });
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
          author_label: authorLabel,
          body_text: proposal.text,
          visible_group_ids: proposal.group_ids,
        });
        if (error) throw new Error(error.message);
        const groupIds = proposal.group_ids;
        const itemName = known.get(proposal.item_id)?.snapshot.label ?? "an item";
        notices.push({
          message: `${authorLabel} on "${itemName}": "${snippet(proposal.text)}"`,
          audience: groupIds,
        });
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
          proposal.days,
          proposal.reason
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
  for (const notice of notices) {
    after(() => notifyGuestsOfChange(calendarId, notice.message, undefined, notice.audience));
  }
  return results;
}
