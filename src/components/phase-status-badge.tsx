import type { PhaseStatus } from "@/lib/actions/calendar-items";

export const STATUS_LABELS: Record<PhaseStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In Progress",
  done: "Done",
  delayed: "Delayed",
};

export const STATUS_COLORS: Record<PhaseStatus, string> = {
  scheduled: "bg-zinc-100 text-zinc-600",
  in_progress: "bg-blue-50 text-blue-700",
  done: "bg-emerald-50 text-emerald-700",
  delayed: "bg-red-50 text-red-700",
};

export function PhaseStatusBadge({ status }: { status: PhaseStatus }) {
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function PhaseStatusSelect({
  status,
  onChange,
  className,
}: {
  status: PhaseStatus;
  onChange: (status: PhaseStatus) => void;
  className?: string;
}) {
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as PhaseStatus)}
      className={
        className ??
        `cursor-pointer rounded-full border-0 px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900/10 ${STATUS_COLORS[status]}`
      }
    >
      {(Object.keys(STATUS_LABELS) as PhaseStatus[]).map((key) => (
        <option key={key} value={key}>
          {STATUS_LABELS[key]}
        </option>
      ))}
    </select>
  );
}
