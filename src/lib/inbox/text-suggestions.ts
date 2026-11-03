import { createAdminClient } from "@/lib/supabase/admin";

const MAX_SUGGESTIONS = 200;

// Notes that an unfamiliar number texted, so the owner can add them with one tap. Only the
// number is kept, never anything the person said. The caller checks the owner turned this on.
export async function recordSuggestion(ownerId: string, handle: string): Promise<boolean> {
  const supabase = createAdminClient();

  // Already on the list means nothing to suggest.
  const { data: contact } = await supabase
    .from("inbox_text_contacts")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("handle", handle)
    .maybeSingle();
  if (contact) return false;

  const { data: existing } = await supabase
    .from("inbox_text_suggestions")
    .select("id, seen_count")
    .eq("owner_id", ownerId)
    .eq("handle", handle)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("inbox_text_suggestions")
      .update({ seen_count: existing.seen_count + 1, last_seen: new Date().toISOString() })
      .eq("id", existing.id);
    return true;
  }

  const { count } = await supabase.from("inbox_text_suggestions").select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
  if ((count ?? 0) >= MAX_SUGGESTIONS) return false;
  await supabase.from("inbox_text_suggestions").insert({ owner_id: ownerId, handle });
  return true;
}
