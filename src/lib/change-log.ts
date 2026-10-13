import type { SupabaseClient } from "@supabase/supabase-js";

// Saves schedule changes into each item's conversation ("Moved from Wed, Oct
// 14 to Sat, Oct 17 — inspector delay"). A change line inherits the item's
// group restriction, so it's visible to exactly the people who see the item.
// Logging must never block the edit that caused it.
export async function logChangeEntries(
  supabase: SupabaseClient,
  rows: { itemId: string; text: string; visibleGroupIds: string[] | null }[],
  authorLabel: string
) {
  if (!rows.length) return;
  const { error } = await supabase.from("entries").insert(
    rows.map((row) => ({
      calendar_item_id: row.itemId,
      author_type: "owner",
      author_label: authorLabel,
      body_text: row.text,
      kind: "change",
      visible_group_ids: row.visibleGroupIds,
    }))
  );
  if (error) console.error("change log failed:", error.message);
}
