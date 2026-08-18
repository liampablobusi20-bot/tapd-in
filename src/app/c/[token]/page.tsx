import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGuestLink } from "@/lib/guest";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { MediaThumbnail } from "@/components/media-thumbnail";
import { GuestEntryForm } from "./guest-entry-form";
import { NotifyToggle } from "./notify-toggle";

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
    .select("id, name, created_at")
    .eq("id", link.calendar_id)
    .single();

  const { data: items } = await supabase
    .from("calendar_items")
    .select("id, label, target_date, notes, updated_at")
    .eq("calendar_id", link.calendar_id)
    .order("sort_order", { ascending: true });

  const itemIds = items?.map((item) => item.id) ?? [];
  const { data: entries } = itemIds.length
    ? await supabase
        .from("entries")
        .select(
          "id, calendar_item_id, author_type, author_label, body_text, photo_url, media_type, created_at"
        )
        .in("calendar_item_id", itemIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const timestamps = [
    calendar?.created_at,
    ...(items?.map((item) => item.updated_at) ?? []),
    ...(entries?.map((entry) => entry.created_at) ?? []),
  ].filter((value): value is string => Boolean(value));
  const lastUpdated = timestamps.length
    ? new Date(Math.max(...timestamps.map((t) => new Date(t).getTime())))
    : null;

  const canComment = link.permission === "comment";

  return (
    <div className="min-h-svh bg-zinc-50 pb-16">
      <header className="border-b border-zinc-200 bg-white px-5 py-5">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
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
        <NotifyToggle token={token} notifyVia={link.notify_via} phone={link.phone} />
      </header>

      <div className="flex flex-col gap-3 px-4 py-4">
        {items?.map((item) => {
          const itemEntries =
            entries?.filter((e) => e.calendar_item_id === item.id) ?? [];
          return (
            <div
              key={item.id}
              className="rounded-lg border border-zinc-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-zinc-900">
                  {item.label}
                </h2>
                {item.target_date && (
                  <span className="flex-shrink-0 text-sm text-zinc-500">
                    {new Date(item.target_date + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" }
                    )}
                  </span>
                )}
              </div>
              {item.notes && (
                <p className="mt-1 text-sm text-zinc-600">{item.notes}</p>
              )}

              {itemEntries.length > 0 && (
                <ul className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3">
                  {itemEntries.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-2 text-sm">
                      {entry.photo_url && (
                        <MediaThumbnail
                          src={entry.photo_url}
                          type={entry.media_type === "video" ? "video" : "image"}
                          className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-zinc-200"
                        />
                      )}
                      <div>
                        {entry.body_text && (
                          <p className="text-zinc-800">{entry.body_text}</p>
                        )}
                        <p className="text-xs text-zinc-500">
                          {entry.author_label}
                          {entry.author_type === "owner" ? " (owner)" : ""} ·{" "}
                          {new Date(entry.created_at).toLocaleDateString(
                            "en-US"
                          )}
                        </p>
                      </div>
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
            No phases have been added to this calendar yet.
          </p>
        )}
      </div>
    </div>
  );
}
