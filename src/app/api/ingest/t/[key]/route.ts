import { createHash } from "node:crypto";
import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestMessage, processPending } from "@/lib/inbox/process";
import { ownerFromKey } from "@/lib/inbox/text-auth";
import { normalizeHandle } from "@/lib/inbox/texts";

export const maxDuration = 60;

const DAILY_LIMIT = 2000;

// The address an iPhone Shortcut posts to: one URL with the key in it, and two
// form fields, "from" and "text". The phone has already chosen whose texts to
// send, so there is no list to check here. The key can be revoked in Settings.
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const auth = await ownerFromKey(key);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // A phone number is kept as an address (so Reply can open Messages): either the
  // optional "number" field, or the sender itself when it is a number. A plain
  // name is kept as the name.
  const handle = normalizeHandle(number) ?? (/[a-z]/i.test(from) ? null : normalizeHandle(from));
  // The people the owner has chosen. A number on the list shows its saved name.
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
  // The newer shortcut checks the list on the phone first (?v=2). This is a second
  // check: anyone not on the list is dropped here and nothing is stored.
  if (new URL(request.url).searchParams.get("v") === "2" && !onList) {
    return NextResponse.json({ ok: true, stored: false });
  }
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
