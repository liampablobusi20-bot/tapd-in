import { createClient } from "@/lib/supabase/server";
import { icsResponse } from "@/lib/ics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: calendar } = await supabase
    .from("calendars")
    .select("name, timezone")
    .eq("id", id)
    .maybeSingle();
  if (!calendar) return new Response("Not found", { status: 404 });

  const { data: items } = await supabase
    .from("calendar_items")
    .select("id, label, target_date, start_time, notes")
    .eq("calendar_id", id);

  return icsResponse(calendar.name, items ?? [], calendar.timezone ?? null);
}
