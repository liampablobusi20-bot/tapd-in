import { createAdminClient } from "@/lib/supabase/admin";

export async function resolveGuestLink(token: string) {
  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("guest_links")
    .select("id, calendar_id, permission, contact_name, phone, notify_via, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (!link || link.revoked_at) return null;
  return link;
}
