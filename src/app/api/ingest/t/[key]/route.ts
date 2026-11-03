import { createHash } from "node:crypto";
import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestMessage, processPending } from "@/lib/inbox/process";
import { ownerFromKey } from "@/lib/inbox/text-auth";
import { getConfig } from "@/lib/inbox/config-store";
import { intakeDecision, senderHandle } from "@/lib/inbox/text-intake";
import { recordSuggestion } from "@/lib/inbox/text-suggestions";

export const maxDuration = 60;

const DAILY_LIMIT = 2000;

// The address an iPhone Shortcut posts to: one URL with the key in it, and two
// form fields, "from" and "text". The phone has already chosen whose texts to
// send. In private mode the phone chose whose texts to send, so they are trusted. In easy mode the
// phone sends every text and this server keeps only people on the owner's list: anyone else is
// dropped before anything is saved, summarized, or sent to the AI. The key can be revoked in Settings.
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const auth = await ownerFromKey(key);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Texts switched off for this account: accept the call (so the phone doesn't keep retrying) and drop it.
  const config = await getConfig(auth.ownerId);
  if (!config.features.texts) return NextResponse.json({ ok: true, ignored: true });

  let from = "";
  let text = "";
  let number = "";
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      from = String(body.from ?? "");
      text = String(body.text ?? "");
      number = String(body.number ?? "");
    } else {
      const form = await request.formData();
      from = String(form.get("from") ?? "");
      text = String(form.get("text") ?? "");
      number = String(form.get("number") ?? "");
    }
  } catch {
    return NextResponse.json({ error: "Couldn't read that." }, { status: 400 });
  }

  from = from.trim().slice(0, 120);
  text = text.trim().slice(0, 4000);
  if (!text) return NextResponse.json({ error: "No text was sent." }, { status: 400 });
  // If the phone put the message in both fields, the sender isn't known.
  if (from.toLowerCase() === text.toLowerCase()) from = "";

  const supabase = createAdminClient();
  const handle = senderHandle(number, from);
  // Who is on the list? Checked first, so a text from anyone else can be dropped before it costs anything.
  let senderName = from || null;
  let onList = false;
  if (handle) {
    const { data: person } = await supabase
      .from("inbox_text_contacts")
      .select("name")
      .eq("owner_id", auth.ownerId)
      .eq("handle", handle)
      .maybeSingle();
    if (person?.name) {
      senderName = person.name;
      onList = true;
    }
  }
  const phoneAskedForCheck = new URL(request.url).searchParams.get("v") === "2";
  if (intakeDecision({ mode: config.textsMode, phoneAskedForCheck, onList }) === "drop") {
    // Nothing about this text is kept. The one exception is the owner's own opt-in: if they asked to be
    // offered new numbers, the sender's number (never the message) is noted so they can add the person.
    if (handle && config.textsMode === "easy") {
      const { data: owner } = await supabase.from("users").select("text_suggestions").eq("id", auth.ownerId).maybeSingle();
      if (owner?.text_suggestions) await recordSuggestion(auth.ownerId, handle);
    }
    return NextResponse.json({ ok: true, stored: false });
  }

  const { count } = await supabase
    .from("inbox_messages")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", auth.ownerId)
    .eq("source", "sms")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= DAILY_LIMIT) return NextResponse.json({ error: "Daily text limit reached." }, { status: 429 });

  // The same text from the same person in the same minute is one text, so a phone
  // that fires its automation twice doesn't double up.
  const minute = Math.floor(Date.now() / 60_000);
  const id = createHash("sha256").update(`${from}|${text}|${minute}`).digest("hex").slice(0, 32);

  // A phone number or email address is kept as the sender's address (so Reply can open Messages),
  // and a number on the list shows its saved name.
  await ingestMessage(auth.ownerId, `sms-${id}`, {
    source: "sms",
    senderName,
    senderAddress: handle,
    subject: null,
    body: text,
    receivedAt: new Date().toISOString(),
  });
  after(() => processPending(5));
  return NextResponse.json({ ok: true });
}
