import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { costMicros, type Usage } from "@/lib/inbox/pricing";
import {
  TRIAGE_SYSTEM,
  buildTriageUser,
  parseTriage,
  skipReason,
  type Category,
  type IncomingMessage,
  type Triage,
} from "@/lib/inbox/triage";

// The small model is plenty for "which bucket, and what did they say".
const MODEL = "claude-haiku-5-5";
const MAX_ATTEMPTS = 3;
const BATCH = 20;

export async function triageWithModel(
  client: Pick<Anthropic, "messages">,
  categories: Category[],
  message: IncomingMessage
): Promise<{ triage: Triage; usage: Usage } | null> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: TRIAGE_SYSTEM,
      messages: [{ role: "user", content: buildTriageUser(categories, message) }],
    });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    const triage = parseTriage(text, categories);
    if (!triage) return null;
    return {
      triage,
      usage: {
        inputTokens:
          response.usage.input_tokens +
          (response.usage.cache_creation_input_tokens ?? 0) +
          (response.usage.cache_read_input_tokens ?? 0),
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (err) {
    // Never log the message itself; it can be private.
    console.error("Inbox triage failed:", err instanceof Error ? err.message : "unknown error");
    return null;
  }
}

// Adds a message to the queue. Safe to call twice for the same message.
export async function ingestMessage(
  ownerId: string,
  externalId: string,
  message: IncomingMessage
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("inbox_messages").upsert(
    {
      owner_id: ownerId,
      source: message.source,
      external_id: externalId,
      sender_name: message.senderName,
      sender_address: message.senderAddress,
      subject: message.subject,
      received_at: message.receivedAt,
      raw_text: message.body,
      headers: message.headers ?? null,
      conversation_id: message.conversationId ?? null,
    },
    { onConflict: "owner_id,source,external_id", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
}

// Works through waiting messages. The text is deleted as soon as a message is
// finished with, whether it was summarized, skipped, or given up on.
export async function processPending(limit = BATCH) {
  const supabase = createAdminClient();
  const client = new Anthropic();
  const tally = { processed: 0, skipped: 0, failed: 0, retry: 0 };

  const { data: waiting } = await supabase
    .from("inbox_messages")
    .select(
      "id, owner_id, source, sender_name, sender_address, subject, received_at, raw_text, headers, attempts"
    )
    .eq("status", "pending")
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);

  const categoriesByOwner = new Map<string, Category[]>();

  for (const row of waiting ?? []) {
    // Claim it first, so two overlapping runs never both spend on one message.
    const { data: claimed } = await supabase
      .from("inbox_messages")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id)
      .eq("status", "pending")
      .eq("attempts", row.attempts)
      .select("id");
    if (!claimed?.length) continue;

    const message: IncomingMessage = {
      source: row.source,
      senderName: row.sender_name,
      senderAddress: row.sender_address,
      subject: row.subject,
      body: row.raw_text ?? "",
      receivedAt: row.received_at,
      headers: row.headers ?? undefined,
    };

    const reason = skipReason(message);
    if (reason) {
      await supabase
        .from("inbox_messages")
        .update({ status: "skipped", skip_reason: reason, raw_text: null, processed_at: new Date().toISOString() })
        .eq("id", row.id);
      tally.skipped++;
      continue;
    }

    if (!categoriesByOwner.has(row.owner_id)) {
      const { data } = await supabase
        .from("inbox_categories")
        .select("id, name, description")
        .eq("owner_id", row.owner_id)
        .order("sort_order", { ascending: true });
      categoriesByOwner.set(row.owner_id, data ?? []);
    }

    const result = await triageWithModel(client, categoriesByOwner.get(row.owner_id)!, message);
    if (result) {
      const { triage, usage } = result;
      await supabase
        .from("inbox_messages")
        .update({
          status: "processed",
          category_id: triage.categoryId,
          summary: triage.summary,
          importance: triage.importance,
          needs_reply: triage.needsReply,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          cost_micros: costMicros(usage),
          raw_text: null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      tally.processed++;
    } else if (row.attempts + 1 >= MAX_ATTEMPTS) {
      await supabase
        .from("inbox_messages")
        .update({ status: "failed", raw_text: null, processed_at: new Date().toISOString() })
        .eq("id", row.id);
      tally.failed++;
    } else {
      tally.retry++;
    }
  }

  return tally;
}

// A message that needs no sorting but should be visible, such as the code
// Gmail emails to confirm forwarding. Stored already finished, with no text kept.
export async function recordNotice(
  ownerId: string,
  externalId: string,
  message: IncomingMessage,
  summary: string
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("inbox_messages").upsert(
    {
      owner_id: ownerId,
      source: message.source,
      external_id: externalId,
      sender_name: message.senderName,
      sender_address: message.senderAddress,
      subject: message.subject,
      received_at: message.receivedAt,
      status: "processed",
      summary,
      importance: "urgent",
      processed_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,source,external_id", ignoreDuplicates: true }
  );
  if (error) throw new Error(error.message);
}
