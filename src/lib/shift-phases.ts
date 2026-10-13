export type ShiftablePhase = {
  id: string;
  target_date: string | null;
  start_time: string | null;
  sort_order: number;
};

export const MAX_SHIFT_DAYS = 365;

export function isValidShiftDays(days: number): boolean {
  return Number.isInteger(days) && days !== 0 && Math.abs(days) <= MAX_SHIFT_DAYS;
}

// Calendar-date math in UTC so daylight-saving changes can't move a date by
// a day.
export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Chronological order: date, then time of day (untimed items first), then
// the order they were created in. Undated items sort last.
export function compareSchedule(
  a: Pick<ShiftablePhase, "target_date" | "start_time" | "sort_order">,
  b: Pick<ShiftablePhase, "target_date" | "start_time" | "sort_order">
): number {
  if (a.target_date !== b.target_date) {
    if (a.target_date === null) return 1;
    if (b.target_date === null) return -1;
    return a.target_date < b.target_date ? -1 : 1;
  }
  const timeA = (a.start_time ?? "").slice(0, 5);
  const timeB = (b.start_time ?? "").slice(0, 5);
  if (timeA !== timeB) return timeA < timeB ? -1 : 1;
  return a.sort_order - b.sort_order;
}

// The anchor phase plus everything scheduled at or after it in
// compareSchedule order. Unscheduled phases never move.
export function selectPhasesToShift(
  anchor: ShiftablePhase,
  all: ShiftablePhase[]
): string[] {
  if (!anchor.target_date) return [];
  return all
    .filter(
      (phase) => phase.target_date !== null && compareSchedule(phase, anchor) >= 0
    )
    .map((phase) => phase.id);
}
