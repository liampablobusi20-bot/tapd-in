export type ThreadEntry = {
  id: string;
  reply_to?: string | null;
  kind: "note" | "change";
  created_at: string;
};

export type Thread<T> = { note: T; replies: T[] };

// Groups notes into conversations: each top-level comment with the replies to
// it underneath, oldest first. Only one level deep, so a reply to a reply is
// shown under the comment it ultimately belongs to. If the comment a reply
// answers isn't visible to the viewer (or no longer exists), the highest
// comment they can see in that chain becomes the top of the conversation, so
// nothing vanishes.
export function buildThreads<T extends ThreadEntry>(entries: T[]): Thread<T>[] {
  const notes = entries
    .filter((entry) => entry.kind !== "change")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byId = new Map(notes.map((note) => [note.id, note]));

  // The topmost visible ancestor, or null if the chain loops back on itself.
  const topOf = (note: T): T | null => {
    let current = note;
    const seen = new Set<string>([note.id]);
    while (current.reply_to) {
      const parent = byId.get(current.reply_to);
      if (!parent) break;
      if (seen.has(parent.id)) return null;
      seen.add(parent.id);
      current = parent;
    }
    return current;
  };

  const threads = new Map<string, Thread<T>>();
  const order: Thread<T>[] = [];
  const replies: { note: T; top: T }[] = [];

  for (const note of notes) {
    const top = topOf(note);
    if (top === null || top.id === note.id) {
      const thread = { note, replies: [] as T[] };
      threads.set(note.id, thread);
      order.push(thread);
    } else {
      replies.push({ note, top });
    }
  }
  for (const { note, top } of replies) threads.get(top.id)?.replies.push(note);

  return order;
}
