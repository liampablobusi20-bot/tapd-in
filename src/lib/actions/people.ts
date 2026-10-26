"use server";

import Anthropic from "@anthropic-ai/sdk";
import { requireInboxOwner } from "@/lib/inbox/require-owner";
import { messagesFor } from "@/lib/inbox/people";
import { summarizePersonNotes } from "@/lib/inbox/conversation-summary";

export type CatchUpResult = { summary: string } | { error: string };

// Combines the one-line notes already kept for a person into a short catch-up.
// Runs only when asked for, and uses the summaries, not the original messages.
export async function catchMeUp(key: string): Promise<CatchUpResult> {
  const { supabase, user } = await requireInboxOwner();
  const { data } = await supabase
    .from("inbox_messages")
    .select("id, source, sender_name, sender_address, summary, importance, received_at")
    .eq("owner_id", user.id)
    .eq("status", "processed")
    .gte("received_at", new Date(Date.now() - 90 * 86_400_000).toISOString())
    .limit(2000);

  const mine = messagesFor(data ?? [], key)
    .filter((m) => m.summary)
    .slice(0, 25)
    .reverse();
  if (mine.length < 2) return { error: "There isn't enough yet to catch up on." };

  const notes = mine.map((m) => ({
    at: `${new Date(m.received_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Phoenix" })} ${m.source === "sms" ? "text" : "email"}`,
    summary: m.summary as string,
  }));
  const name = mine[mine.length - 1].sender_name ?? "this person";
  const summary = await summarizePersonNotes(new Anthropic(), name, notes);
  return summary ? { summary } : { error: "Couldn't catch you up. Try again." };
}
