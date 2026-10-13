import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGuestLink, visibleToGuest } from "@/lib/guest";
import { buildSystemPrompt } from "@/lib/assistant/context";
import {
  describeProposal,
  type AssistantGroup,
  type AssistantGuest,
  type AssistantItem,
} from "@/lib/assistant/proposals";
import { runAssistant } from "@/lib/assistant/run";
import { makeExecutor, toolsFor, type AssistantMode } from "@/lib/assistant/tools";

export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";
const DAILY_LIMIT: Record<AssistantMode, number> = { owner: 200, guest: 60 };
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  let body: { calendarId?: unknown; token?: unknown; messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request.", 400);
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages = rawMessages
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        typeof m === "object" &&
        m !== null &&
        ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant") &&
        typeof (m as { content?: unknown }).content === "string" &&
        (m as { content: string }).content.trim().length > 0
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return fail("Invalid request.", 400);
  }

  let mode: AssistantMode;
  let db: SupabaseClient;
  let calendarId: string;
  let groupId: string | null = null;

  if (typeof body.token === "string") {
    const link = await resolveGuestLink(body.token);
    if (!link) return fail("This link isn't available.", 404);
    mode = "guest";
    db = createAdminClient();
    calendarId = link.calendar_id;
    groupId = link.group_id ?? null;
  } else if (typeof body.calendarId === "string") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail("Please sign in again.", 401);
    mode = "owner";
    db = supabase;
    calendarId = body.calendarId;
  } else {
    return fail("Invalid request.", 400);
  }

  const { data: calendar } = await db
    .from("calendars")
    .select("name, timezone")
    .eq("id", calendarId)
    .maybeSingle();
  if (!calendar) return fail("Calendar not found.", 404);

  if (!process.env.ANTHROPIC_API_KEY) {
    return fail("The assistant isn't set up yet.", 503);
  }

  // Per-calendar daily cap, so a shared guest link can't run up the API bill.
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: usageError } = await admin
    .from("assistant_usage")
    .select("id", { count: "exact", head: true })
    .eq("calendar_id", calendarId)
    .eq("actor", mode)
    .gte("created_at", since);
  if (usageError) {
    console.error("assistant_usage check failed:", usageError.message);
    return fail("The assistant isn't fully set up yet.", 503);
  }
  if ((count ?? 0) >= DAILY_LIMIT[mode]) {
    return fail("The daily assistant limit for this calendar has been reached. Try again tomorrow.", 429);
  }
  await admin.from("assistant_usage").insert({ calendar_id: calendarId, actor: mode });

  let itemQuery = db
    .from("calendar_items")
    .select("id, label, target_date, start_time, notes, status, sort_order, visible_group_ids")
    .eq("calendar_id", calendarId)
    .order("target_date", { ascending: true, nullsFirst: false });
  // A guest's assistant only ever sees the items that guest may see.
  if (mode === "guest") itemQuery = visibleToGuest(itemQuery, groupId);
  const { data: itemRows } = await itemQuery;
  const items = (itemRows ?? []) as AssistantItem[];

  // Groups and guests are only given to the owner's assistant.
  let groups: AssistantGroup[] = [];
  let guests: AssistantGuest[] = [];
  if (mode === "owner") {
    const [{ data: groupRows }, { data: guestRows }] = await Promise.all([
      db.from("guest_groups").select("id, name").eq("calendar_id", calendarId),
      db
        .from("guest_links")
        .select("id, contact_name, group_id")
        .eq("calendar_id", calendarId)
        .is("revoked_at", null),
    ]);
    groups = (groupRows ?? []) as AssistantGroup[];
    guests = (guestRows ?? []) as AssistantGuest[];
  }

  // Same visibility rule as the guest page: restricted notes never reach a
  // guest outside the chosen groups, so they can't reach the model either.
  const loadEntries = async () => {
    const ids = items.map((item) => item.id);
    if (!ids.length) return [];
    let query = db
      .from("entries")
      .select("calendar_item_id, author_label, body_text, photo_url, kind, created_at")
      .in("calendar_item_id", ids)
      .order("created_at", { ascending: false })
      .limit(500);
    if (mode === "guest") {
      query = groupId
        ? query.or(`visible_group_ids.is.null,visible_group_ids.cs.{${groupId}}`)
        : query.is("visible_group_ids", null);
    }
    const { data } = await query;
    return data ?? [];
  };

  try {
    const result = await runAssistant({
      client: new Anthropic(),
      model: MODEL,
      system: buildSystemPrompt({
        mode,
        calendarName: calendar.name,
        timezone: calendar.timezone ?? null,
        items,
        groups,
        guests,
      }),
      messages,
      tools: toolsFor(mode),
      executeTool: makeExecutor({ mode, items, loadEntries, groups, guests }),
    });

    return NextResponse.json({
      reply: result.text,
      proposals: result.proposals.map((proposal) => ({
        proposal,
        summary: describeProposal(proposal, items, { groups, guests }),
      })),
    });
  } catch (error) {
    console.error("assistant failed:", error);
    return fail("The assistant is unavailable right now. Try again in a moment.", 502);
  }
}
