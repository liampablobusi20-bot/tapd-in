// One row per account for the administrator's status page. Counts and dates only:
// no message content ever reaches that page.

const DAY_MS = 86_400_000;

export type AccountInput = {
  users: { id: string; email: string; created_at: string; inbox_enabled: boolean }[];
  connections: { owner_id: string; account_email: string; status: string; last_synced_at: string | null; calendar_enabled: boolean | null }[];
  // Messages from the last 30 days, with no text.
  messages: { owner_id: string; source: string; status: string; received_at: string }[];
  digests: { owner_id: string; week_start: string }[];
};

export type AccountRow = {
  id: string;
  email: string;
  createdAt: string;
  enabled: boolean;
  outlook: { account: string; status: string; lastSyncedAt: string | null; calendar: boolean }[];
  lastText: string | null;
  messages7d: number;
  failed7d: number;
  lastDigest: string | null;
};

export function summarizeAccounts(input: AccountInput, nowMs: number): AccountRow[] {
  const weekAgo = nowMs - 7 * DAY_MS;
  return [...input.users]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((u) => {
      const mine = input.messages.filter((m) => m.owner_id === u.id);
      const recent = mine.filter((m) => Date.parse(m.received_at) >= weekAgo);
      const texts = mine.filter((m) => m.source === "sms").map((m) => m.received_at);
      const digests = input.digests.filter((d) => d.owner_id === u.id).map((d) => d.week_start);
      return {
        id: u.id,
        email: u.email,
        createdAt: u.created_at,
        enabled: u.inbox_enabled,
        outlook: input.connections
          .filter((c) => c.owner_id === u.id)
          .map((c) => ({ account: c.account_email, status: c.status, lastSyncedAt: c.last_synced_at, calendar: Boolean(c.calendar_enabled) })),
        lastText: texts.length ? texts.reduce((a, b) => (a > b ? a : b)) : null,
        messages7d: recent.length,
        failed7d: recent.filter((m) => m.status === "failed").length,
        lastDigest: digests.length ? digests.reduce((a, b) => (a > b ? a : b)) : null,
      };
    });
}
