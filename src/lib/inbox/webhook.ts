// Pure helpers for the inbound-email webhook: signature check, working out
// whose inbox a message belongs to, and tidying the sender and headers.

import { createHmac, timingSafeEqual } from "node:crypto";

// Resend signs webhooks with Svix: HMAC-SHA256 over "<id>.<timestamp>.<body>",
// keyed by the base64 part of the "whsec_..." secret.
export function verifySvix({
  secret,
  id,
  timestamp,
  signature,
  body,
  nowMs = Date.now(),
  toleranceSec = 300,
}: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  nowMs?: number;
  toleranceSec?: number;
}): boolean {
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > toleranceSec) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  for (const part of signature.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    const given = Buffer.from(value, "base64");
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}

export function parseAddress(raw: string | null | undefined): {
  name: string | null;
  address: string | null;
} {
  if (!raw) return { name: null, address: null };
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim() || null, address: match[2].trim().toLowerCase() };
  }
  const bare = raw.trim();
  return { name: null, address: bare.includes("@") ? bare.toLowerCase() : null };
}

// Finds the owner token in whichever recipient field carries our address.
// Auto-forwarded mail keeps the original "To", so the address we gave out may
// only appear in received_for.
export function ownerTokenFromAddresses(
  addresses: (string | null | undefined)[],
  inboxDomain: string
): string | null {
  const domain = inboxDomain.trim().toLowerCase();
  for (const raw of addresses) {
    const address = parseAddress(raw).address;
    if (!address) continue;
    const [local, host] = address.split("@");
    if (host === domain && /^[a-z0-9]{16,64}$/.test(local)) return local;
  }
  return null;
}

type HeaderValue = string | string[] | undefined;

function header(headers: Record<string, HeaderValue> | null | undefined, name: string): string | null {
  if (!headers) return null;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) {
      const first = Array.isArray(value) ? value[0] : value;
      return first?.trim() || null;
    }
  }
  return null;
}

export function mailHeaders(headers: Record<string, HeaderValue> | null | undefined) {
  return {
    listUnsubscribe: header(headers, "list-unsubscribe"),
    precedence: header(headers, "precedence"),
    autoSubmitted: header(headers, "auto-submitted"),
  };
}

// Gmail won't start forwarding until the code it emails to the new address is
// entered. That email would otherwise be skipped or buried, so pull the code out.
export function gmailForwardingCode(subject: string | null, body: string): string | null {
  if (!subject || !/gmail forwarding confirmation/i.test(subject)) return null;
  return (
    subject.match(/#(\d{6,10})/)?.[1] ??
    body.match(/confirmation code:?\s*(\d{6,10})/i)?.[1] ??
    null
  );
}

// Plain text of a received email; falls back to stripped HTML.
export function bodyText(text: string | null | undefined, html: string | null | undefined): string {
  if (text?.trim()) return text;
  if (!html) return "";
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
