import { createAdminClient } from "@/lib/supabase/admin";
import type { ActivityEvent } from "@/lib/inbox/activity";

// Records something that happened on an account. Written with the server key, because
// owners can only read this log, never change it. A failure here must never get in
// the way of what the person was doing, so it is only reported to the server log.
export async function logActivity(ownerId: string, event: ActivityEvent, detail?: string | null): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("inbox_activity")
      .insert({ owner_id: ownerId, event, detail: detail ?? null });
    if (error) console.error("Activity log write failed:", error.message);
  } catch (err) {
    console.error("Activity log write failed:", err instanceof Error ? err.message : "unknown error");
  }
}
