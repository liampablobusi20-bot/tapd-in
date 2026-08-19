import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarName } from "./calendar-name";
import { DeleteCalendarButton } from "./delete-calendar-button";
import { CalendarGrid } from "./calendar-grid";
import { InviteSection } from "./invite-section";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!calendar) notFound();

  const { data: items } = await supabase
    .from("calendar_items")
    .select("id, label, target_date, notes, updated_at")
    .eq("calendar_id", id)
    .order("sort_order", { ascending: true });

  const itemIds = items?.map((item) => item.id) ?? [];
  const { data: entries } = itemIds.length
    ? await supabase
        .from("entries")
        .select(
          "id, calendar_item_id, author_label, body_text, photo_url, media_type, created_at"
        )
        .in("calendar_item_id", itemIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const { data: guestLinks } = await supabase
    .from("guest_links")
    .select("id, token, permission, contact_name, notify_via, created_at")
    .eq("calendar_id", id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, phone, email")
    .order("last_invited_at", { ascending: false, nullsFirst: false });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-start justify-between gap-4">
        <CalendarName calendarId={calendar.id} initialName={calendar.name} />
        <DeleteCalendarButton calendarId={calendar.id} calendarName={calendar.name} />
      </div>

      <CalendarGrid
        calendarId={id}
        items={items ?? []}
        entries={entries ?? []}
      />

      <InviteSection
        calendarId={id}
        links={guestLinks ?? []}
        contacts={contacts ?? []}
      />
    </div>
  );
}
