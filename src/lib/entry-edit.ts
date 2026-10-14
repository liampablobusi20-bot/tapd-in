const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_NOTE_LENGTH = 2000;

export type EntryForEdit = {
  author_type: "owner" | "guest";
  kind: "note" | "change";
  photo_url: string | null;
};

export type EntryUpdate = {
  body_text?: string | null;
  // null = visible to everyone; an array limits it to those groups.
  visible_group_ids?: string[] | null;
};

type Result = { ok: true; update: EntryUpdate } | { ok: false; error: string };

// What the owner may change on an existing note: who can see it (any note,
// including a guest's) and, for notes the owner wrote, the text. The
// automatic schedule-history lines can't be edited, so they stay a faithful
// record.
export function validateEntryEdit(
  entry: EntryForEdit,
  fields: { body_text?: unknown; visible_group_ids?: unknown }
): Result {
  if (entry.kind === "change") {
    return { ok: false, error: "Schedule history can't be edited." };
  }
  const update: EntryUpdate = {};

  if (fields.body_text !== undefined) {
    if (entry.author_type !== "owner") {
      return { ok: false, error: "You can only edit notes you wrote." };
    }
    if (typeof fields.body_text !== "string" || fields.body_text.length > MAX_NOTE_LENGTH) {
      return { ok: false, error: `Notes can be up to ${MAX_NOTE_LENGTH} characters.` };
    }
    const text = fields.body_text.trim();
    if (!text && !entry.photo_url) {
      return { ok: false, error: "A note needs text or a photo." };
    }
    update.body_text = text || null;
  }

  if (fields.visible_group_ids !== undefined) {
    const ids = fields.visible_group_ids;
    if (ids === null) {
      update.visible_group_ids = null;
    } else if (
      Array.isArray(ids) &&
      ids.length <= 20 &&
      ids.every((id) => typeof id === "string" && UUID.test(id))
    ) {
      update.visible_group_ids = ids.length ? [...new Set(ids as string[])] : null;
    } else {
      return { ok: false, error: "Invalid audience." };
    }
  }

  if (Object.keys(update).length === 0) return { ok: false, error: "Nothing to change." };
  return { ok: true, update };
}

export function canDeleteEntry(entry: Pick<EntryForEdit, "kind">): boolean {
  return entry.kind === "note";
}
