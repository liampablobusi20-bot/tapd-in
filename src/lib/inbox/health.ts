// Works out what, if anything, needs the administrator's attention, from a snapshot
// of how the system is doing. It holds no message content: only counts and accounts.

import { lastFullWeek } from "@/lib/inbox/digest";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const PHOENIX_OFFSET_MS = 7 * HOUR;

export const PENDING_TOO_LONG_MS = 20 * MINUTE;
export const STALE_SYNC_MS = 30 * MINUTE;
export const ALERT_COOLDOWN_MS = 6 * HOUR;

export type ConnectionHealth = {
  id: string;
  account: string;
  status: string;
  lastSyncedAt: string | null;
  createdAt: string;
};

export type HealthSnapshot = {
  nowMs: number;
  // Messages that have waited longer than PENDING_TOO_LONG_MS to be summarized.
  pendingTooLong: number;
  failedLastHour: number;
  connections: ConnectionHealth[];
  // Only set while the Monday email is due: who should have it and who got it.
  digest: { weekKey: string; expected: string[]; sent: string[] } | null;
  newSignups: { id: string; email: string }[];
};

export type HealthAlert = { key: string; level: "problem" | "info"; title: string; detail: string };

export function evaluateHealth(s: HealthSnapshot): HealthAlert[] {
  const alerts: HealthAlert[] = [];

  if (s.pendingTooLong > 0) {
    alerts.push({
      key: "pending-backlog",
      level: "problem",
      title: `${s.pendingTooLong} ${s.pendingTooLong === 1 ? "message is" : "messages are"} stuck waiting to be summarized`,
      detail: "Check the Anthropic account (credit, spend limit, key) and the Vercel logs for the process job.",
    });
  }
  if (s.failedLastHour >= 3) {
    alerts.push({
      key: "failed-burst",
      level: "problem",
      title: `${s.failedLastHour} messages failed to summarize in the last hour`,
      detail: "Summaries are failing. The usual causes are the Anthropic key, credit, or spend limit.",
    });
  }

  for (const c of s.connections) {
    if (c.status === "needs_reconnect") {
      alerts.push({
        key: `reconnect:${c.id}`,
        level: "problem",
        title: `${c.account} needs to reconnect Outlook`,
        detail: "Their sign-in stopped working, so no new mail is being read. They can reconnect in Settings.",
      });
      continue;
    }
    const reference = Date.parse(c.lastSyncedAt ?? c.createdAt);
    const waited = s.nowMs - reference;
    if (c.status === "active" && waited > STALE_SYNC_MS) {
      alerts.push({
        key: `stale:${c.id}`,
        level: "problem",
        title: `Mail hasn't been checked for ${c.account} in over ${Math.floor(waited / MINUTE)} minutes`,
        detail: "The scheduled sync isn't completing. Check the Vercel cron logs.",
      });
    }
  }

  if (s.digest) {
    const got = new Set(s.digest.sent);
    const missing = s.digest.expected.filter((id) => !got.has(id));
    if (missing.length > 0) {
      alerts.push({
        key: `digest:${s.digest.weekKey}`,
        level: "problem",
        title: `The Monday email didn't reach ${missing.length} ${missing.length === 1 ? "person" : "people"}`,
        detail: "It was retried automatically and still failed. Check Resend, then use Email me this week for them.",
      });
    }
  }

  for (const user of s.newSignups) {
    alerts.push({
      key: `signup:${user.id}`,
      level: "info",
      title: `New request for access: ${user.email}`,
      detail: "Switch them on from the status page when you're ready.",
    });
  }
  return alerts;
}

// Problems repeat only after the cooldown; information is only ever sent once.
export function alertsToSend(alerts: HealthAlert[], lastSent: Map<string, number>, nowMs: number): HealthAlert[] {
  return alerts.filter((a) => {
    const last = lastSent.get(a.key);
    if (last === undefined) return true;
    return a.level === "problem" && nowMs - last >= ALERT_COOLDOWN_MS;
  });
}

// The Monday email goes out at 7:00 am Phoenix. It counts as "due" from 7:30 am that
// day for 24 hours, which is long enough to retry and warn, and no longer.
export function digestWindow(nowMs: number): { weekKey: string } | null {
  const week = lastFullWeek(nowMs);
  const local = new Date(nowMs - PHOENIX_OFFSET_MS);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const mondayMidnight = midnight - ((local.getUTCDay() + 6) % 7) * 86_400_000;
  const dueFrom = mondayMidnight + 7.5 * HOUR;
  const localNow = nowMs - PHOENIX_OFFSET_MS;
  return localNow >= dueFrom && localNow < dueFrom + 24 * HOUR ? { weekKey: week.weekStart } : null;
}

export function alertEmail(alerts: HealthAlert[]): { subject: string; text: string } {
  const problems = alerts.filter((a) => a.level === "problem");
  const lead = problems.length > 0 ? `Tapd In: ${problems.length} ${problems.length === 1 ? "problem" : "problems"}` : "Tapd In: update";
  const lines = alerts.map((a) => `${a.level === "problem" ? "PROBLEM" : "NOTE"}: ${a.title}\n${a.detail}`);
  return { subject: lead, text: `${lines.join("\n\n")}\n\nStatus page: ${(process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "")}/admin` };
}
