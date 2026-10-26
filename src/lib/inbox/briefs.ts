// Pre-meeting briefs: for each upcoming meeting, what you know about who is coming.

import { isWaiting, personKey, type PersonMessage } from "@/lib/inbox/people";
import type { CalendarEvent } from "@/lib/inbox/microsoft";

export type BriefAttendee = {
  name: string;
  address: string;
  waiting: PersonMessage[];
  owed: PersonMessage[];
  recent: PersonMessage[];
  lastAt: string | null;
};

export type MeetingBrief = {
  id: string;
  subject: string;
  startIso: string;
  endIso: string;
  // Attendees you have heard from. Others are not listed.
  attendees: BriefAttendee[];
  // How many invited people there are in all, besides you.
  invited: number;
};

const hasName = (name: string | null | undefined) => Boolean(name && /[a-z]/i.test(name));

const unresolvedPromise = (m: PersonMessage) => Boolean(m.promise) && !m.promise_resolved_at;

// Only meetings with at least one person you've heard from get a brief, so the
// section stays short. People are matched by email address, or by the same name.
export function buildBriefs(events: CalendarEvent[], messages: PersonMessage[], ownAddresses: string[], limit = 3): MeetingBrief[] {
  const own = new Set(ownAddresses.map((a) => a.trim().toLowerCase()));
  const newestFirst = [...messages].sort((a, b) => Date.parse(b.received_at) - Date.parse(a.received_at));
  const briefs: MeetingBrief[] = [];

  for (const event of events) {
    const others = event.attendees.filter((a) => !own.has(a.address));
    const attendees: BriefAttendee[] = [];
    for (const a of others) {
      const nameKey = hasName(a.name) ? personKey(a.name, null) : "";
      const mine = newestFirst.filter(
        (m) => (m.sender_address && m.sender_address.toLowerCase() === a.address) || (nameKey && personKey(m.sender_name, m.sender_address) === nameKey)
      );
      if (mine.length === 0) continue;
      const waiting = mine.filter(isWaiting).reverse();
      const owed = mine.filter(unresolvedPromise).reverse();
      const shown = new Set([...waiting, ...owed].map((m) => m.id));
      attendees.push({
        name: (hasName(a.name) ? a.name : mine.find((m) => hasName(m.sender_name))?.sender_name) ?? a.address,
        address: a.address,
        waiting,
        owed,
        recent: mine.filter((m) => m.summary && !shown.has(m.id)).slice(0, 3),
        lastAt: mine[0].received_at,
      });
    }
    if (attendees.length === 0) continue;
    briefs.push({ id: event.id, subject: event.subject, startIso: event.startIso, endIso: event.endIso, attendees, invited: others.length });
  }
  return briefs.sort((a, b) => Date.parse(a.startIso) - Date.parse(b.startIso)).slice(0, limit);
}
