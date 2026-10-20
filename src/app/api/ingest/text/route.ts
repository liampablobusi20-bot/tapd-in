import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestMessage, processPending } from "@/lib/inbox/process";
import { ownerFromBearer } from "@/lib/inbox/text-auth";
import { validateTextBatch } from "@/lib/inbox/texts";

export const maxDuration = 60;

// Most texts one person's devices can add in a day. A guard against a runaway
// helper running up AI costs.
const DAILY_LIMIT = 2000;

// Receives texts from the helper on a person's Mac. The key says whose they
// are, and each text is accepted only if its sender is on that person's
// allow-list, so this stays safe even if the helper is wrong or modified.
export async function POST(request: Request) {
  const auth = await ownerFromBearer(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const batch = validateTextBatch(body);
  if (!batch.ok) return NextResponse.json({ error: batch.error }, { status: 400 });

  const supabase = createAdminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase
    .from("inbox_messages")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", auth.ownerId)
    .eq("source", "sms")
    .gte("created_at", since);
  if ((count ?? 0) + batch.items.length > DAILY_LIMIT) {
    return NextResponse.json({ error: "Daily text limit reached." }, { status: 429 });
  }

  const { data: contacts } = await supabase
    .from("inbox_text_contacts")
    .select("name, handle")
    .eq("owner_id", auth.ownerId);
  const allowed = new Map((contacts ?? []).map((c) => [c.handle, c.name]));

  let accepted = 0;
  let rejected = 0;
  for (const item of batch.items) {
    const name = allowed.get(item.handle);
    if (!name) {
      rejected++;
      continue;
    }
    await ingestMessage(auth.ownerId, `sms-${item.id}`, {
      source: "sms",
      senderName: name,
      senderAddress: item.handle,
      subject: null,
      body: item.text,
      receivedAt: item.sentAt,
    });
    accepted++;
  }

  if (accepted > 0) after(() => processPending(20));
  return NextResponse.json({ accepted, rejected, dropped: batch.dropped });
}
