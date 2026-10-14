import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CalendarName } from "./calendar-name";
import { CalendarTimezone } from "./calendar-timezone";
import { DeleteCalendarButton } from "./delete-calendar-button";
import { CalendarGrid } from "./calendar-grid";
import { InviteSection } from "./invite-section";
import { ProgressSummary } from "@/components/progress-summary";
import { AssistantPanel } from "@/components/assistant-panel";
import { signEntryMedia } from "@/lib/media-urls";

// Server actions on this page wait ~20s before sending batched notifications.
export const maxDuration = 60;

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id, name, timezone")
    .eq("id", id)
    .maybeSingle();

  if (!calendar) notFound();

  const { data: items } = await supabase
    .from("calendar_items")
    .select("id, label, target_date, start_time, notes, status, sort_order, visible_group_ids, updated_at")
    .eq("calendar_id", id)
    .order("sort_order", { ascending: true });

  const itemIds = items?.map((item) => item.id) ?? [];
  const { data: rawEntries } = itemIds.length
    ? await supabase
        .from("entries")
        .select(
          "id, calendar_item_id, author_type, author_label, body_text, photo_url, media_type, visible_group_ids, kind, created_at"
        )
        .in("calendar_item_id", itemIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const entries = await signEntryMedia(rawEntries ?? []);

  const { data: guestLinks } = await supabase
    .from("guest_links")
    .select("id, token, permission, contact_name, notify_via, group_id, created_at")
    .eq("calendar_id", id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const { data: groups } = await supabase
    .from("guest_groups")
    .select("id, name")
    .eq("calendar_id", id)
    .order("created_at", { ascending: true });

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, name, phone, email")
    .order("last_invited_at", { ascending: false, nullsFirst: false });

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56" data-tour="calendar-header">
          <CalendarName calendarId={calendar.id} initialName={calendar.name} />
          <CalendarTimezone calendarId={calendar.id} timezone={calendar.timezone} />
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <a
            href={`/dashboard/calendars/${calendar.id}/calendar.ics`}
            download
            className="text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
          >
            Export to calendar
          </a>
          <DeleteCalendarButton calendarId={calendar.id} calendarName={calendar.name} />
        </div>
      </div>

      <ProgressSummary items={items ?? []} entries={entries ?? []} />

      <CalendarGrid
        calendarId={id}
        items={items ?? []}
        entries={entries ?? []}
        groups={groups ?? []}
        timezone={calendar.timezone}
      />

      <InviteSection
        calendarId={id}
        links={guestLinks ?? []}
        groups={groups ?? []}
        contacts={contacts ?? []}
      />
      {Boolean(process.env.ANTHROPIC_API_KEY) && (
        <AssistantPanel mode="owner" calendarId={id} />
      )}
    </div>
  );
}
