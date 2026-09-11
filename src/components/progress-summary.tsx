import { MediaThumbnail } from "@/components/media-thumbnail";
import type { PhaseStatus } from "@/lib/actions/calendar-items";

type Phase = { id: string; status: PhaseStatus };
type Entry = {
  calendar_item_id: string;
  photo_url: string | null;
  media_type: string | null;
  created_at: string;
};

const RECENT_PHOTO_LIMIT = 6;

export function ProgressSummary({
  items,
  entries,
}: {
  items: Phase[];
  entries: Entry[];
}) {
  if (items.length === 0) return null;

  const doneCount = items.filter((i) => i.status === "done").length;
  const delayedCount = items.filter((i) => i.status === "delayed").length;
  const pct = Math.round((doneCount / items.length) * 100);

  const recentMedia = entries
    .filter(
      (e) =>
        e.photo_url &&
        (e.media_type === "image" || e.media_type === "video" || !e.media_type)
    )
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, RECENT_PHOTO_LIMIT);

  return (
    <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-zinc-900">
            {doneCount} of {items.length} phases done
          </p>
          {delayedCount > 0 && (
            <p className="mt-0.5 text-xs font-medium text-red-600">
              {delayedCount} {delayedCount === 1 ? "phase" : "phases"} delayed
            </p>
          )}
        </div>
        <span className="text-2xl font-bold tabular-nums text-zinc-900">
          {pct}%
        </span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {recentMedia.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {recentMedia.map((entry, i) => (
            <MediaThumbnail
              key={`${entry.calendar_item_id}-${i}`}
              src={entry.photo_url!}
              type={entry.media_type === "video" ? "video" : "image"}
              className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-zinc-200 shadow-sm"
            />
          ))}
        </div>
      )}
    </div>
  );
}
