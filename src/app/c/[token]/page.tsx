import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGuestLink, visibleToGuest } from "@/lib/guest";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { MediaThumbnail } from "@/components/media-thumbnail";
import { PhaseStatusBadge } from "@/components/phase-status-badge";
import { ProgressSummary } from "@/components/progress-summary";
import { GuestEntryForm } from "./guest-entry-form";
import { NotifyToggle } from "./notify-toggle";
import { GuestMenu } from "./guest-menu";
import { AddToCalendar } from "./add-to-calendar";
import { AssistantPanel } from "@/components/assistant-panel";
import { ProductTour } from "@/components/tour/product-tour";
import { signEntryMedia } from "@/lib/media-urls";
import { buildThreads } from "@/lib/threads";
import { GuestReply } from "./guest-reply";
import { compareSchedule } from "@/lib/shift-phases";
import { ItemTime } from "@/components/item-time";

// Server actions on this page wait ~20s before sending batched notifications.
export const maxDuration = 60;

export default async function GuestCalendarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const link = await resolveGuestLink(token);

  if (!link) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50 px-6 text-center">
        <h1 className="text-lg font-semibold text-zinc-900">
          This link isn&apos;t available
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          It may have been revoked. Ask the project owner for a new link.
        </p>
      </div>
    );
  }

  const supabase = createAdminClient();

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id, name, timezone, created_at")
    .eq("id", link.calendar_id)
    .single();

  const { data: rawItems } = await visibleToGuest(
    supabase
      .from("calendar_items")
      .select("id, label, target_date, start_time, notes, status, sort_order, updated_at")
      .eq("calendar_id", link.calendar_id),
    link.group_id
  );
  const items = rawItems ? [...rawItems].sort(compareSchedule) : rawItems;

  const itemIds = items?.map((item) => item.id) ?? [];
  // Restricted entries are filtered out in the query itself so they never
  // reach this render: an ungrouped guest only gets unrestricted entries, a
  // grouped guest also gets entries shared with their group.
  // Notes on an item the guest can't see are excluded too: entries are looked
  // up by the ids of the visible items only.
  const allEntries = supabase
    .from("entries")
    .select(
      "id, calendar_item_id, author_type, author_label, body_text, photo_url, media_type, kind, reply_to, created_at"
    )
    .in("calendar_item_id", itemIds)
    .order("created_at", { ascending: true });
  const { data: rawEntries } = itemIds.length
    ? await (link.group_id
        ? allEntries.or(
            `visible_group_ids.is.null,visible_group_ids.cs.{${link.group_id}}`
          )
        : allEntries.is("visible_group_ids", null))
    : { data: [] };
  const entries = await signEntryMedia(rawEntries ?? []);

  const timestamps = [
    calendar?.created_at,
    ...(items?.map((item) => item.updated_at) ?? []),
    ...(entries?.map((entry) => entry.created_at) ?? []),
  ].filter((value): value is string => Boolean(value));
  const lastUpdated = timestamps.length
    ? new Date(Math.max(...timestamps.map((t) => new Date(t).getTime())))
    : null;

  const canComment = link.permission === "comment";
  const guestName = link.contact_name ?? "";

  type GuestEntry = NonNullable<typeof entries>[number];
  function renderNote(
    entry: GuestEntry,
    itemId: string,
    canReply: boolean,
    replyingToName?: string | null
  ) {
    return (
      <div className="flex items-start gap-2 text-sm">
        {entry.photo_url && (
          <MediaThumbnail
            src={entry.photo_url}
            type={
              entry.media_type === "video" || entry.media_type === "file"
                ? entry.media_type
                : "image"
            }
            className={
              entry.media_type === "file"
                ? undefined
                : "h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-zinc-200"
            }
          />
        )}
        <div className="min-w-0">
          {entry.body_text && <p className="text-zinc-800">{entry.body_text}</p>}
          <div className="text-xs text-zinc-500">
            {entry.author_label}
            {entry.author_type === "owner" ? " (owner)" : ""} ·{" "}
            {new Date(entry.created_at).toLocaleDateString("en-US")}
            {replyingToName && <span> · replying to {replyingToName}</span>}
            {canReply && canComment && (
              <GuestReply
                token={token}
                calendarItemId={itemId}
                parentId={entry.id}
                defaultName={guestName}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-zinc-50 pb-16">
      <header className="border-b border-zinc-200 bg-white px-5 py-5">
        <GuestMenu />
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Shared project calendar
        </p>
        <h1 className="mt-0.5 text-xl font-semibold text-zinc-900">
          {calendar?.name}
        </h1>
        {lastUpdated && (
          <p className="mt-1 text-xs text-zinc-500">
            Updated {formatRelativeTime(lastUpdated)}
          </p>
        )}
        <NotifyToggle
          token={token}
          notifyVia={link.notify_via}
          phone={link.phone}
          email={link.email}
        />
        <AddToCalendar token={token} />
      </header>

      <div className="px-4 pt-4">
        <ProgressSummary items={items ?? []} entries={entries ?? []} />
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        {items?.map((item) => {
          const itemEntries =
            entries?.filter((e) => e.calendar_item_id === item.id) ?? [];
          const threads = buildThreads(itemEntries);
          return (
            <div
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate text-base font-semibold text-zinc-900">
                    {item.label}
                  </h2>
                  <PhaseStatusBadge status={item.status} />
                </div>
                {item.target_date && (
                  <span className="flex-shrink-0 text-sm text-zinc-500">
                    {new Date(item.target_date + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" }
                    )}
                    {item.start_time && item.target_date && (
                      <>
                        {" · "}
                        <ItemTime
                          dateKey={item.target_date}
                          time={item.start_time}
                          timezone={calendar?.timezone ?? null}
                        />
                      </>
                    )}
                  </span>
                )}
              </div>
              {item.notes && (
                <p className="mt-1 text-sm text-zinc-600">{item.notes}</p>
              )}

              {itemEntries.some((entry) => entry.kind === "change") && (
                <details className="group mt-3 border-t border-zinc-100 pt-2.5">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-zinc-400 hover:text-zinc-700 [&::-webkit-details-marker]:hidden">
                    <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3 transition-transform group-open:rotate-90" aria-hidden>
                      <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    History ({itemEntries.filter((entry) => entry.kind === "change").length})
                  </summary>
                  <ul className="mt-1.5 flex flex-col gap-1 border-l border-zinc-200 pl-3 text-xs text-zinc-500">
                    {itemEntries
                      .filter((entry) => entry.kind === "change")
                      .map((entry) => (
                        <li key={entry.id}>
                          {entry.body_text} ·{" "}
                          {new Date(entry.created_at).toLocaleDateString("en-US")}
                        </li>
                      ))}
                  </ul>
                </details>
              )}

              {threads.length > 0 && (
                <ul className="mt-3 flex flex-col gap-3 border-t border-zinc-100 pt-3">
                  {threads.map(({ note, replies }) => (
                    <li key={note.id}>
                      {renderNote(note, item.id, true)}
                      {replies.length > 0 && (
                        <ul className="ml-3 mt-2 flex flex-col gap-2.5 border-l-2 border-zinc-200 pl-3">
                          {replies.map((reply) => (
                            <li key={reply.id}>
                              {renderNote(reply, item.id, false, note.author_label)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {canComment && (
                <GuestEntryForm
                  token={token}
                  calendarItemId={item.id}
                  defaultName={link.contact_name ?? ""}
                />
              )}
            </div>
          );
        })}

        {items?.length === 0 && (
          <p className="px-2 py-8 text-center text-sm text-zinc-500">
            Nothing has been added to this calendar yet.
          </p>
        )}
      </div>
      {Boolean(process.env.ANTHROPIC_API_KEY) && (
        <AssistantPanel mode="guest" token={token} />
      )}
      <ProductTour variant="guest" autoStart />
    </div>
  );
}
