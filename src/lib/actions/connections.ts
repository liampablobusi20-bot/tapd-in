"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInboxOwner } from "@/lib/inbox/require-owner";

// Disconnecting deletes the stored sign-in, so no more mail can be read.
export async function disconnectEmail(id: string) {
  const { user } = await requireInboxOwner();
  const { error } = await createAdminClient()
    .from("inbox_connections")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
}

// Turning meeting briefs off stops Tapd In reading the calendar right away.
export async function disableMeetingBriefs(id: string) {
  const { user } = await requireInboxOwner();
  const { error } = await createAdminClient()
    .from("inbox_connections")
    .update({ calendar_enabled: false })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}
