import type { SupabaseClient, User } from "@supabase/supabase-js";

// The name guests see on the owner's notes and schedule changes: the display
// name the owner chose, else their email.
export async function ownerLabel(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">
): Promise<string> {
  const { data } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  return data?.display_name?.trim() || user.email || "Owner";
}
