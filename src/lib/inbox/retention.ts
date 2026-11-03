// How long summaries are kept before they are deleted automatically.

export const RETENTION_OPTIONS = [90, 180, 365] as const;
export type RetentionDays = (typeof RETENTION_OPTIONS)[number];
export const DEFAULT_RETENTION: RetentionDays = 180;

const DAY_MS = 86_400_000;

export function isRetention(value: unknown): value is RetentionDays {
  return typeof value === "number" && (RETENTION_OPTIONS as readonly number[]).includes(value);
}

// Anything received before this moment has expired.
export function retentionCutoff(nowMs: number, days: number): string {
  return new Date(nowMs - days * DAY_MS).toISOString();
}

export function retentionLabel(days: number): string {
  return days === 365 ? "1 year" : `${days} days`;
}
