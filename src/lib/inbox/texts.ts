// Pure helpers for text messages that arrive from a person's own device.

import { createHash, randomBytes } from "node:crypto";

// A phone number becomes digits only, without a leading US country code, and an
// email address becomes lowercase. Anything else is rejected. The Mac helper
// applies the same rule so both sides agree on who a handle is.
export function normalizeHandle(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.toLowerCase() : null;
  }
  let digits = s.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

export const KEY_PREFIX = "tt_";

export function generateKey(): { key: string; hash: string; prefix: string } {
  const key = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return { key, hash: hashKey(key), prefix: key.slice(0, KEY_PREFIX.length + 4) };
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export type TextItem = { id: string; handle: string; text: string; sentAt: string };

const MAX_BATCH = 100;
const MAX_TEXT = 4000;
const DAY_MS = 86_400_000;

// Checks a batch sent by the helper. Bad items are dropped and counted, a batch
// that isn't a list at all is refused. Messages the person sent themselves are
// ignored here too, as a second guard on top of the helper.
export function validateTextBatch(
  input: unknown,
  nowMs: number = Date.now()
): { ok: true; items: TextItem[]; dropped: number } | { ok: false; error: string } {
  const list = (input as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(list)) return { ok: false, error: "Expected a list of messages." };
  if (list.length > MAX_BATCH) return { ok: false, error: `Send at most ${MAX_BATCH} messages at a time.` };

  const items: TextItem[] = [];
  let dropped = 0;
  for (const raw of list) {
    const m = raw as Record<string, unknown> | null;
    const id = typeof m?.id === "string" ? m.id.trim() : "";
    const text = typeof m?.text === "string" ? m.text.trim() : "";
    const handle = typeof m?.handle === "string" ? normalizeHandle(m.handle) : null;
    const sentMs = typeof m?.sentAt === "string" ? Date.parse(m.sentAt) : NaN;
    if (
      m?.fromMe === true ||
      !id ||
      id.length > 200 ||
      !text ||
      !handle ||
      !Number.isFinite(sentMs) ||
      sentMs < nowMs - 30 * DAY_MS ||
      sentMs > nowMs + DAY_MS
    ) {
      dropped++;
      continue;
    }
    items.push({ id, handle, text: text.slice(0, MAX_TEXT), sentAt: new Date(sentMs).toISOString() });
  }
  return { ok: true, items, dropped };
}

// A phone number can be texted back from the briefing; an email handle can't.
export function replyLink(handle: string | null | undefined): string | null {
  if (!handle) return null;
  if (handle.includes("@")) return `mailto:${handle}`;
  const digits = handle.replace(/\D/g, "");
  if (digits.length === 10) return `sms:+1${digits}`;
  return digits.length >= 7 ? `sms:+${digits}` : null;
}
