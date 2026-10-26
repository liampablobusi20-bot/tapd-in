// Groups messages by the person who sent them, across email and texts.

export type PersonMessage = {
  id: string;
  source: string;
  sender_name: string | null;
  sender_address: string | null;
  summary: string | null;
  importance: string | null;
  received_at: string;
  needs_reply?: boolean | null;
  resolved_at?: string | null;
  answered_at?: string | null;
};

// A name written the same way in email and in a text is the same person. A
// sender with only a number or address is grouped by that.
export function personKey(name: string | null | undefined, address: string | null | undefined): string {
  const cleaned = (name ?? "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  if (cleaned && /[a-z]/.test(cleaned)) return cleaned;
  return (address ?? cleaned).trim().toLowerCase();
}

export type Person = {
  key: string;
  name: string;
  count: number;
  lastAt: string;
  channels: ("Email" | "Text")[];
  waiting: number;
};

const isWaiting = (m: PersonMessage) => Boolean(m.needs_reply) && !m.resolved_at && !m.answered_at;

// One row per person, most recently heard from first.
export function groupPeople(messages: PersonMessage[], formatAddress: (a: string) => string = (a) => a): Person[] {
  const people = new Map<string, Person>();
  const sorted = [...messages].sort((a, b) => Date.parse(b.received_at) - Date.parse(a.received_at));
  for (const m of sorted) {
    const key = personKey(m.sender_name, m.sender_address);
    if (!key) continue;
    let person = people.get(key);
    if (!person) {
      const label = m.sender_name && /[a-z]/i.test(m.sender_name) ? m.sender_name.trim() : formatAddress(m.sender_address ?? key);
      person = { key, name: label, count: 0, lastAt: m.received_at, channels: [], waiting: 0 };
      people.set(key, person);
    }
    person.count++;
    const channel = m.source === "sms" ? "Text" : "Email";
    if (!person.channels.includes(channel)) person.channels.push(channel);
    if (isWaiting(m)) person.waiting++;
  }
  return [...people.values()];
}

export function messagesFor(messages: PersonMessage[], key: string): PersonMessage[] {
  return messages
    .filter((m) => personKey(m.sender_name, m.sender_address) === key)
    .sort((a, b) => Date.parse(b.received_at) - Date.parse(a.received_at));
}

export { isWaiting };
