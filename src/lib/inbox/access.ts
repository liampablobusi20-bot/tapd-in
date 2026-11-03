import { createAdminClient } from "@/lib/supabase/admin";
import { isPaused, trialState } from "@/lib/inbox/trial";

const COLUMNS = "id, subscription_status, trial_ends_at, stripe_subscription_id, billing_issue_at";

// Who is paused right now: a trial that ended without a card (after its grace period), a
// failed payment that wasn't fixed in time, or an account the administrator paused. Their
// data is kept, but nothing new is read, sorted or emailed until they are restored.
export async function pausedOwnerIds(ownerIds?: string[], nowMs = Date.now()): Promise<Set<string>> {
  const paused = new Set<string>();
  if (ownerIds && ownerIds.length === 0) return paused;
  let query = createAdminClient().from("users").select(COLUMNS).limit(5000);
  if (ownerIds) query = query.in("id", ownerIds);
  const { data } = await query;
  for (const account of data ?? []) if (isPaused(trialState(account, nowMs))) paused.add(account.id);
  return paused;
}
