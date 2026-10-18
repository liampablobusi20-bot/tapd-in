// Builds the weekly update: messages grouped by category, who said what.

import type { Importance } from "@/lib/inbox/triage";

export type DigestCategory = { id: string; name: string; sort_order: number };

export type DigestMessage = {
  category_id: string | null;
  sender_name: string | null;
  sender_address: string | null;
  summary: string;
  importance: Importance;
  received_at: string;
};

const PER_CATEGORY = 12;

function who(message: DigestMessage): string {
  return message.sender_name?.trim() || message.sender_address?.trim() || "Someone";
}

function day(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", timeZone });
}

function range(startIso: string, endIso: string, timeZone: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
  // The end is the start of the next week, so show the day before it.
  const lastDay = new Date(new Date(endIso).getTime() - 60_000).toISOString();
  return `${fmt(startIso)} – ${fmt(lastDay)}`;
}

export function composeDigest({
  name,
  categories,
  messages,
  weekStart,
  weekEnd,
  timeZone = "America/Phoenix",
  appUrl,
}: {
  name: string | null;
  categories: DigestCategory[];
  messages: DigestMessage[];
  weekStart: string;
  weekEnd: string;
  timeZone?: string;
  appUrl?: string;
}): { subject: string; text: string } {
  // Low-importance chatter stays out of the update; it's still in the app.
  const kept = messages.filter((m) => m.importance !== "low");
  const urgent = kept.filter((m) => m.importance === "urgent").length;

  const subject = kept.length
    ? `Your week: ${kept.length} ${kept.length === 1 ? "thing" : "things"} worth knowing` +
      (urgent ? `, ${urgent} urgent` : "")
    : "Your week: nothing important came in";

  const lines: string[] = [];
  lines.push(`${name ? `${name}, here` : "Here"} is your week (${range(weekStart, weekEnd, timeZone)}).`);
  lines.push("");

  const ordered = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const sections: { title: string; items: DigestMessage[] }[] = ordered.map((c) => ({
    title: c.name,
    items: kept.filter((m) => m.category_id === c.id),
  }));
  const known = new Set(ordered.map((c) => c.id));
  sections.push({ title: "Other", items: kept.filter((m) => !m.category_id || !known.has(m.category_id)) });

  for (const section of sections) {
    if (!section.items.length) continue;
    const sorted = [...section.items].sort((a, b) => {
      if (a.importance !== b.importance) return a.importance === "urgent" ? -1 : 1;
      return new Date(b.received_at).getTime() - new Date(a.received_at).getTime();
    });
    lines.push(section.title.toUpperCase());
    for (const m of sorted.slice(0, PER_CATEGORY)) {
      const flag = m.importance === "urgent" ? "URGENT: " : "";
      lines.push(`• ${who(m)} (${day(m.received_at, timeZone)}): ${flag}${m.summary}`);
    }
    if (sorted.length > PER_CATEGORY) {
      lines.push(`  …and ${sorted.length - PER_CATEGORY} more`);
    }
    lines.push("");
  }

  if (!kept.length) {
    lines.push("Nothing important came through this week.");
    lines.push("");
  }
  if (appUrl) lines.push(`See everything, including the originals: ${appUrl}`);

  return { subject, text: lines.join("\n").trim() };
}

// Phoenix has no daylight saving, so local time is always UTC-7.
const PHOENIX_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

// The Monday-to-Monday week that just ended, in Phoenix time.
export function lastFullWeek(nowMs: number): { startIso: string; endIso: string; weekStart: string } {
  const local = new Date(nowMs - PHOENIX_OFFSET_MS);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  const thisMonday = midnight - sinceMonday * DAY_MS;
  const lastMonday = thisMonday - 7 * DAY_MS;
  return {
    startIso: new Date(lastMonday + PHOENIX_OFFSET_MS).toISOString(),
    endIso: new Date(thisMonday + PHOENIX_OFFSET_MS).toISOString(),
    weekStart: new Date(lastMonday).toISOString().slice(0, 10),
  };
}

export function lastSevenDays(nowMs: number): { startIso: string; endIso: string } {
  return { startIso: new Date(nowMs - 7 * DAY_MS).toISOString(), endIso: new Date(nowMs).toISOString() };
}
