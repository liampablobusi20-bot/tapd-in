import { formatTime } from "@/lib/format-time";
import type { PhaseStatus } from "@/lib/actions/calendar-items";

export type ItemSnapshot = {
  label: string;
  target_date: string | null;
  start_time: string | null;
  status: PhaseStatus;
  notes: string | null;
};

// thread: the line saved into the item's conversation (null = nothing to log).
// notify: the sentence people get in a notification, naming the item.
export type ItemChange = { thread: string | null; notify: string };

export const dayText = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const STATUS_TEXT: Record<PhaseStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  done: "Done",
  delayed: "Delayed",
};

export function cleanReason(reason: unknown): string | null {
  if (typeof reason !== "string") return null;
  const trimmed = reason.trim().slice(0, 200);
  return trimmed || null;
}

// Plain-English description of what changed on one item.
export function diffItem(
  before: ItemSnapshot,
  after: ItemSnapshot,
  reason?: string | null
): ItemChange[] {
  const why = cleanReason(reason) ? ` — ${cleanReason(reason)}` : "";
  const name = `"${after.label}"`;
  const changes: ItemChange[] = [];

  if (before.label !== after.label) {
    changes.push({
      thread: `Renamed from "${before.label}"`,
      notify: `Renamed "${before.label}" to "${after.label}"`,
    });
  }

  if (before.target_date !== after.target_date) {
    if (!before.target_date && after.target_date) {
      const text = `scheduled for ${dayText(after.target_date)}`;
      changes.push({ thread: `Scheduled for ${dayText(after.target_date)}${why}`, notify: `${name} ${text}${why}` });
    } else if (before.target_date && !after.target_date) {
      const text = `unscheduled (was ${dayText(before.target_date)})`;
      changes.push({ thread: `Unscheduled (was ${dayText(before.target_date)})${why}`, notify: `${name} ${text}${why}` });
    } else if (before.target_date && after.target_date) {
      const text = `moved from ${dayText(before.target_date)} to ${dayText(after.target_date)}`;
      changes.push({ thread: `Moved from ${dayText(before.target_date)} to ${dayText(after.target_date)}${why}`, notify: `${name} ${text}${why}` });
    }
  }

  const beforeTime = before.start_time?.slice(0, 5) ?? null;
  const afterTime = after.start_time?.slice(0, 5) ?? null;
  if (beforeTime !== afterTime) {
    const thread = !afterTime
      ? "Time removed"
      : !beforeTime
        ? `Time set to ${formatTime(afterTime)}`
        : `Time changed from ${formatTime(beforeTime)} to ${formatTime(afterTime)}`;
    changes.push({ thread: `${thread}${why}`, notify: `${name}: ${thread.charAt(0).toLowerCase()}${thread.slice(1)}${why}` });
  }

  if (before.status !== after.status) {
    changes.push({
      thread: `Marked ${STATUS_TEXT[after.status]}${why}`,
      notify: `${name} marked ${STATUS_TEXT[after.status]}${why}`,
    });
  }

  if ((before.notes ?? "") !== (after.notes ?? "")) {
    changes.push({ thread: null, notify: `Notes updated on ${name}` });
  }

  return changes;
}

export function snippet(text: string | null | undefined, max = 100): string {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
