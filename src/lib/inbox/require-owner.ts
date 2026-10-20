import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Every inbox action starts here: a signed-in owner whose inbox is switched on.
export async function requireInboxOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("users")
    .select("inbox_enabled")
    .eq("id", user.id)
    .single();
  if (!profile?.inbox_enabled) redirect("/dashboard");
  return { supabase, user };
}
