// Urgent alerts: when to send, and what the email says. Pure, so it can be tested alone.

const HOUR_MS = 3_600_000;
const PHOENIX_OFFSET_MS = 7 * HOUR_MS;

// Quiet from 10 pm to 6 am Arizona time. Anything urgent that arrives overnight is sent at 6.
export const QUIET_FROM_HOUR = 22;
export const QUIET_UNTIL_HOUR = 6;
// Nothing older than this is alerted about, so turning alerts on never sends a flood of old items.
export const URGENT_LOOKBACK_MS = 24 * HOUR_MS;
export const MAX_LISTED = 5;

// A window that wraps midnight (22 to 6) or sits within one day (0 to 6). If the two hours are
// the same there are no quiet hours at all.
export function inQuietHours(nowMs: number, from: number = QUIET_FROM_HOUR, until: number = QUIET_UNTIL_HOUR): boolean {
  const hour = new Date(nowMs - PHOENIX_OFFSET_MS).getUTCHours();
  if (from === until) return false;
  return from > until ? hour >= from || hour < until : hour >= from && hour < until;
}

export type UrgentItem = { sender: string; via: "email" | "text"; summary: string };

export function composeUrgentEmail(
  name: string | null | undefined,
  items: UrgentItem[],
  appUrl?: string
): { subject: string; text: string } {
  const first = items[0];
  const subject =
    items.length === 1 ? `Urgent: ${first.sender}` : `Urgent: ${items.length} messages need your attention`;
  const greeting = name?.trim() ? `${name.trim()}, ` : "";
  const shown = items.slice(0, MAX_LISTED);
  const lines = shown.map((i) => `• ${i.sender} (${i.via}): ${i.summary}`);
  const more = items.length > shown.length ? [`+ ${items.length - shown.length} more in your briefing`] : [];
  const text = [
    `${greeting}something urgent came in:`.replace(/^./, (c) => c.toUpperCase()),
    "",
    ...lines,
    ...more,
    "",
    appUrl ? `Open your briefing: ${appUrl}` : "Open your briefing in Tapd In.",
    "",
    "You're getting this because urgent alerts are on. Turn them off any time in Settings.",
  ].join("\n");
  return { subject, text };
}
