import { createAdminClient } from "@/lib/supabase/admin";

export async function resolveGuestLink(token: string) {
  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("guest_links")
    .select(
      "id, calendar_id, permission, contact_name, phone, email, notify_via, group_id, revoked_at"
    )
    .eq("token", token)
    .maybeSingle();

  if (!link || link.revoked_at) return null;
  return link;
}

// The one visibility rule for guests, for items and notes alike: unrestricted
// (null) is visible to everyone; a restricted one only to guests in a listed
// group. A guest with no group sees only unrestricted things.
export function isVisibleToGuest(
  visibleGroupIds: string[] | null,
  guestGroupId: string | null
): boolean {
  if (visibleGroupIds === null) return true;
  return guestGroupId !== null && visibleGroupIds.includes(guestGroupId);
}

// The same rule as a database filter, for queries that read as a guest.
export function visibleToGuest<
  Q extends {
    or: (filters: string) => Q;
    is: (column: string, value: null) => Q;
  },
>(query: Q, guestGroupId: string | null): Q {
  return guestGroupId
    ? query.or(`visible_group_ids.is.null,visible_group_ids.cs.{${guestGroupId}}`)
    : query.is("visible_group_ids", null);
}
