// Groups texts into conversations: messages from the same person, where each one
// follows the last by no more than a few hours.

export type ConvoMessage = {
  id: string;
  sender_address: string | null;
  sender_name: string | null;
  received_at: string;
};

const GAP_MS = 6 * 3_600_000;

export function conversationKey(m: Pick<ConvoMessage, "sender_address" | "sender_name">): string {
  return (m.sender_address ?? m.sender_name ?? "").trim().toLowerCase();
}

// Maps every message id to the ordered ids of the conversation it belongs to.
export function groupConversations(messages: ConvoMessage[], gapMs: number = GAP_MS): Map<string, string[]> {
  const byPerson = new Map<string, ConvoMessage[]>();
  for (const m of messages) {
    const key = conversationKey(m);
    if (!key) continue;
    const list = byPerson.get(key) ?? [];
    list.push(m);
    byPerson.set(key, list);
  }

  const result = new Map<string, string[]>();
  for (const list of byPerson.values()) {
    list.sort((a, b) => Date.parse(a.received_at) - Date.parse(b.received_at));
    let current: ConvoMessage[] = [];
    const flush = () => {
      const ids = current.map((m) => m.id);
      for (const id of ids) result.set(id, ids);
      current = [];
    };
    for (const m of list) {
      const last = current[current.length - 1];
      if (last && Date.parse(m.received_at) - Date.parse(last.received_at) > gapMs) flush();
      current.push(m);
    }
    flush();
  }
  return result;
}
