import { createAdminClient } from "@/lib/supabase/admin";
import { adminEmails } from "@/lib/admin";
import { sendEmail } from "@/lib/email";
import { lastFullWeek } from "@/lib/inbox/digest";
import { sendDigest } from "@/lib/inbox/send-digest";
import {
  PENDING_TOO_LONG_MS,
  alertEmail,
  alertsToSend,
  digestWindow,
  evaluateHealth,
  type HealthAlert,
  type HealthSnapshot,
} from "@/lib/inbox/health";

// Reads how the system is doing. Counts and account names only, never message content.
export async function gatherSnapshot(nowMs: number): Promise<HealthSnapshot> {
  const admin = createAdminClient();
  const iso = (ms: number) => new Date(ms).toISOString();

  const [{ count: pendingTooLong }, { count: failedLastHour }, { data: connections }, { data: signups }] = await Promise.all([
    admin
      .from("inbox_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", iso(nowMs - PENDING_TOO_LONG_MS)),
    admin
      .from("inbox_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("processed_at", iso(nowMs - 3_600_000)),
    admin.from("inbox_connections").select("id, account_email, status, last_synced_at, created_at").eq("provider", "microsoft"),
    admin
      .from("users")
      .select("id, email")
      .eq("inbox_enabled", false)
      .gte("created_at", iso(nowMs - 24 * 3_600_000)),
  ]);

  let digest: HealthSnapshot["digest"] = null;
  const due = digestWindow(nowMs);
  if (due) {
    const week = lastFullWeek(nowMs);
    const [{ data: owners }, { data: sent }, { data: active }] = await Promise.all([
      admin.from("users").select("id").eq("inbox_enabled", true),
      admin.from("inbox_digests").select("owner_id").eq("week_start", due.weekKey),
      // Only people who had something that week count. Someone switched on this morning
      // shouldn't be sent an empty email for a week they weren't connected.
      admin.from("inbox_messages").select("owner_id").gte("received_at", week.startIso).lt("received_at", week.endIso).limit(5000),
    ]);
    const hadMessages = new Set((active ?? []).map((m) => m.owner_id));
    digest = {
      weekKey: due.weekKey,
      expected: (owners ?? []).map((o) => o.id).filter((id) => hadMessages.has(id)),
      sent: (sent ?? []).map((s) => s.owner_id),
    };
  }

  return {
    nowMs,
    pendingTooLong: pendingTooLong ?? 0,
    failedLastHour: failedLastHour ?? 0,
    connections: (connections ?? []).map((c) => ({
      id: c.id,
      account: c.account_email,
      status: c.status,
      lastSyncedAt: c.last_synced_at,
      createdAt: c.created_at,
    })),
    digest,
    newSignups: (signups ?? []).map((u) => ({ id: u.id, email: u.email })),
  };
}

// Anyone who should have this week's email and doesn't gets one more try.
async function retryMissingDigests(snapshot: HealthSnapshot) {
  if (!snapshot.digest) return;
  const got = new Set(snapshot.digest.sent);
  const week = lastFullWeek(snapshot.nowMs);
  for (const id of snapshot.digest.expected) {
    if (!got.has(id)) await sendDigest(id, week, week.weekStart);
  }
}

export type HealthResult = { problems: number; alerted: number; configured: boolean };

// Run every 15 minutes. Emails the administrator about anything new that is wrong.
export async function runHealthCheck(nowMs = Date.now()): Promise<HealthResult> {
  let snapshot = await gatherSnapshot(nowMs);
  if (snapshot.digest) {
    await retryMissingDigests(snapshot);
    snapshot = await gatherSnapshot(nowMs);
  }
  const alerts = evaluateHealth(snapshot);
  const recipients = adminEmails();
  const problems = alerts.filter((a) => a.level === "problem").length;
  if (alerts.length === 0 || recipients.length === 0) return { problems, alerted: 0, configured: recipients.length > 0 };

  const admin = createAdminClient();
  const { data: past, error: pastError } = await admin
    .from("system_alerts")
    .select("key, last_sent_at, times_sent")
    .in("key", alerts.map((a) => a.key));
  // Without the record of what was already sent, every run would email again.
  if (pastError) {
    console.error("Health check can't read system_alerts:", pastError.message);
    return { problems, alerted: 0, configured: true };
  }
  const lastSent = new Map((past ?? []).map((r) => [r.key, Date.parse(r.last_sent_at)]));
  const timesSent = new Map((past ?? []).map((r) => [r.key, r.times_sent as number]));

  const fresh: HealthAlert[] = alertsToSend(alerts, lastSent, nowMs);
  if (fresh.length === 0) return { problems, alerted: 0, configured: true };

  const mail = alertEmail(fresh);
  const results = await Promise.all(recipients.map((to) => sendEmail(to, mail.subject, mail.text)));
  if (!results.some(Boolean)) return { problems, alerted: 0, configured: true };

  const now = new Date(nowMs).toISOString();
  await admin.from("system_alerts").upsert(
    fresh.map((a) => ({ key: a.key, last_sent_at: now, times_sent: (timesSent.get(a.key) ?? 0) + 1 })),
    { onConflict: "key" }
  );
  return { problems, alerted: fresh.length, configured: true };
}
