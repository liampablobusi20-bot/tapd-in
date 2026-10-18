import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestMessage, processPending, recordNotice } from "@/lib/inbox/process";
import {
  bodyText,
  gmailForwardingCode,
  mailHeaders,
  ownerTokenFromAddresses,
  parseAddress,
  verifySvix,
} from "@/lib/inbox/webhook";

export const maxDuration = 60;

const MAX_BODY_CHARS = 20_000;

type ReceivedEvent = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    received_for?: string[];
    subject?: string;
    message_id?: string;
    created_at?: string;
  };
};

// Resend calls this when mail arrives at <token>@<INBOX_DOMAIN>. The signature
// is checked against the raw body before anything is trusted. Every answer
// that isn't a bad signature is a plain 200, so nobody can use this route to
// find out which addresses exist.
export async function POST(request: Request) {
  const raw = await request.text();
  const valid = verifySvix({
    secret: process.env.RESEND_WEBHOOK_SECRET ?? "",
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body: raw,
  });
  if (!valid) return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });

  let event: ReceivedEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  const data = event.data;
  if (event.type !== "email.received" || !data?.email_id) return NextResponse.json({ ok: true });

  const token = ownerTokenFromAddresses(
    [...(data.received_for ?? []), ...(data.to ?? []), ...(data.cc ?? []), ...(data.bcc ?? [])],
    process.env.INBOX_DOMAIN ?? ""
  );
  if (!token) return NextResponse.json({ ok: true });

  const supabase = createAdminClient();
  const { data: owner } = await supabase
    .from("users")
    .select("id")
    .eq("inbox_token", token)
    .eq("inbox_enabled", true)
    .maybeSingle();
  if (!owner) return NextResponse.json({ ok: true });

  // The webhook only carries metadata; the text comes from a second call.
  const res = await fetch(`https://api.resend.com/emails/receiving/${data.email_id}?html_format=cid`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });
  if (!res.ok) {
    console.error("Fetching received email failed:", res.status);
    // A non-2xx makes Resend retry later.
    return NextResponse.json({ error: "Could not fetch email" }, { status: 502 });
  }
  const full = (await res.json()) as {
    from?: string;
    subject?: string;
    text?: string | null;
    html?: string | null;
    headers?: Record<string, string | string[]>;
    message_id?: string;
    created_at?: string;
  };

  const sender = parseAddress(full.from ?? data.from);
  const body = bodyText(full.text, full.html).slice(0, MAX_BODY_CHARS);
  const subject = full.subject ?? data.subject ?? null;
  const message = {
    source: "forward" as const,
    senderName: sender.name,
    senderAddress: sender.address,
    subject,
    body,
    receivedAt: full.created_at ?? data.created_at ?? new Date().toISOString(),
    headers: mailHeaders(full.headers),
  };
  const externalId = full.message_id ?? data.message_id ?? data.email_id;

  const code = gmailForwardingCode(subject, body);
  if (code) {
    await recordNotice(
      owner.id,
      externalId,
      message,
      `Gmail forwarding confirmation code: ${code}. Enter it in Gmail's forwarding settings to finish setup.`
    );
  } else {
    await ingestMessage(owner.id, externalId, message);
    after(() => processPending(5));
  }
  return NextResponse.json({ ok: true });
}
