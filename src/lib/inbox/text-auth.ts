import { createAdminClient } from "@/lib/supabase/admin";
import { KEY_PREFIX, hashKey } from "@/lib/inbox/texts";

// Works out whose device is calling from its key. A key that is unknown, revoked,
// or belongs to an account whose inbox is switched off gets nothing.
export async function ownerFromKey(key: string): Promise<{ ownerId: string } | null> {
  if (!key.startsWith(KEY_PREFIX) || key.length > 100) return null;

  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("inbox_text_keys")
    .select("id, owner_id, revoked_at")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  if (!row || row.revoked_at) return null;

  const { data: owner } = await supabase
    .from("users")
    .select("inbox_enabled")
    .eq("id", row.owner_id)
    .maybeSingle();
  if (!owner?.inbox_enabled) return null;

  await supabase
    .from("inbox_text_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id);
  return { ownerId: row.owner_id };
}

export function ownerFromBearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return ownerFromKey(header.startsWith("Bearer ") ? header.slice(7).trim() : "");
}
