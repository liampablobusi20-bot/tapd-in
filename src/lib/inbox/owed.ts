// What others promised the owner, and whether it is late.

const DAY_MS = 86_400_000;
const PHOENIX_OFFSET_MS = 7 * 3_600_000;
// Promises due sooner than this, or already late, are worth surfacing in the briefing.
export const SOON_DAYS = 2;

// Today's date in Phoenix, as YYYY-MM-DD.
export function phoenixToday(nowMs: number = Date.now()): string {
  return new Date(nowMs - PHOENIX_OFFSET_MS).toISOString().slice(0, 10);
}

export type OwedState = { state: "late" | "soon" | "later" | "undated"; days: number };

// days: how many days late, or how many days until it is due.
export function owedState(due: string | null | undefined, today: string = phoenixToday()): OwedState {
  if (!due) return { state: "undated", days: 0 };
  const diff = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (diff < 0) return { state: "late", days: -diff };
  if (diff <= SOON_DAYS) return { state: "soon", days: diff };
  return { state: "later", days: diff };
}

export const worthSurfacing = (s: OwedState) => s.state === "late" || s.state === "soon";

export function owedLabel(s: OwedState, due: string | null | undefined): string {
  if (s.state === "late") return `${s.days} ${s.days === 1 ? "day" : "days"} late`;
  if (s.state === "undated") return "No date given";
  if (s.days === 0) return "Due today";
  if (s.days === 1) return "Due tomorrow";
  const weekday = new Date(`${due}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return s.state === "soon" ? `Due ${weekday}` : `Due ${new Date(`${due}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
}

const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "there";

// A short, polite check-in the owner can edit before sending.
export function nudgeText(name: string | null | undefined, promise: string, due: string | null | undefined, today?: string): string {
  const s = owedState(due, today);
  const hi = `Hi ${firstName(name)},`;
  const you = `you mentioned you'd ${promise.replace(/[.!]+$/, "")}`;
  if (s.state === "late") return `${hi} checking in: ${you}. Do you have an update?\n\nThanks`;
  if (s.state === "soon") return `${hi} quick check: ${you}. Still on track?\n\nThanks`;
  return `${hi} just checking in: ${you}. Any update?\n\nThanks`;
}

export type NudgeTarget = { source: string; sender_name: string | null; sender_address: string | null; subject?: string | null };

// A link that opens a ready-to-edit message in the owner's own mail app or Messages.
export function nudgeLink(m: NudgeTarget, promise: string, due: string | null | undefined, today?: string): string | null {
  if (!m.sender_address) return null;
  const body = nudgeText(m.sender_name, promise, due, today);
  if (m.source === "sms") {
    const digits = m.sender_address.replace(/\D/g, "");
    if (m.sender_address.includes("@") || digits.length < 7) return null;
    return `sms:${digits.length === 10 ? "+1" : "+"}${digits}&body=${encodeURIComponent(body)}`;
  }
  const subject = m.subject?.trim() ? `Re: ${m.subject.replace(/^re:\s*/i, "")}` : "Checking in";
  return `mailto:${m.sender_address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
