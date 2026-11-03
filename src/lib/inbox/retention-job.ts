import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_RETENTION, isRetention, retentionCutoff } from "@/lib/inbox/retention";

export type PurgeResult = { owners: number; messagesDeleted: number; failed: number };

// Deletes each owner's summaries older than the time they chose to keep them for
// (180 days unless they changed it). Run once a day. Also tidies records that only
// exist for bookkeeping, so nothing lingers.
export async function purgeExpired(nowMs = Date.now()): Promise<PurgeResult> {
  const admin = createAdminClient();
  const { data: owners } = await admin.from("users").select("id, retention_days").limit(2000);

  const result: PurgeResult = { owners: 0, messagesDeleted: 0, failed: 0 };
  for (const owner of owners ?? []) {
    const days = isRetention(owner.retention_days) ? owner.retention_days : DEFAULT_RETENTION;
    const { data, error } = await admin
      .from("inbox_messages")
      .delete()
      .eq("owner_id", owner.id)
      .lt("received_at", retentionCutoff(nowMs, days))
      .select("id");
    if (error) {
      result.failed++;
      console.error("Retention purge failed:", error.message);
      continue;
    }
    result.owners++;
    result.messagesDeleted += data?.length ?? 0;
  }

  // A year of account activity, and alert records older than 90 days, are plenty.
  await admin.from("inbox_activity").delete().lt("created_at", retentionCutoff(nowMs, 365));
  await admin.from("system_alerts").delete().lt("last_sent_at", retentionCutoff(nowMs, 90));
  return result;
}
