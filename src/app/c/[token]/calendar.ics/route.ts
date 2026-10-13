import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGuestLink, visibleToGuest } from "@/lib/guest";
import { icsResponse } from "@/lib/ics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const link = await resolveGuestLink(token);
  if (!link) return new Response("Not found", { status: 404 });

  const supabase = createAdminClient();
  const [{ data: calendar }, { data: items }] = await Promise.all([
    supabase.from("calendars").select("name, timezone").eq("id", link.calendar_id).single(),
    visibleToGuest(
      supabase
        .from("calendar_items")
        .select("id, label, target_date, start_time, notes")
        .eq("calendar_id", link.calendar_id),
      link.group_id
    ),
  ]);

  return icsResponse(calendar?.name ?? "Calendar", items ?? [], calendar?.timezone ?? null);
}
