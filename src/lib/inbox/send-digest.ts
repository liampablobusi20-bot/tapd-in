import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { composeDigest } from "@/lib/inbox/digest";

// Sends one owner's update for a window. With a weekKey it is sent at most once
// per week (the claim is taken before sending and released if sending fails).
export async function sendDigest(
  ownerId: string,
  window: { startIso: string; endIso: string },
  weekKey?: string
): Promise<"sent" | "already-sent" | "failed"> {
  const supabase = createAdminClient();

  if (weekKey) {
    const { error } = await supabase
      .from("inbox_digests")
      .insert({ owner_id: ownerId, week_start: weekKey });
    if (error) return error.code === "23505" ? "already-sent" : "failed";
  }

  const release = async () => {
    if (weekKey) {
      await supabase.from("inbox_digests").delete().eq("owner_id", ownerId).eq("week_start", weekKey);
    }
  };

  const { data: owner } = await supabase
    .from("users")
    .select("email, display_name")
    .eq("id", ownerId)
    .maybeSingle();
  if (!owner?.email) {
    await release();
    return "failed";
  }

  const [{ data: categories }, { data: messages }] = await Promise.all([
    supabase
      .from("inbox_categories")
      .select("id, name, sort_order")
      .eq("owner_id", ownerId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("inbox_messages")
      .select("category_id, sender_name, sender_address, summary, importance, received_at")
      .eq("owner_id", ownerId)
      .eq("status", "processed")
      .gte("received_at", window.startIso)
      .lt("received_at", window.endIso)
      .order("received_at", { ascending: false })
      .limit(500),
  ]);

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const digest = composeDigest({
    name: owner.display_name,
    categories: categories ?? [],
    messages: (messages ?? []).flatMap((m) =>
      m.summary && m.importance ? [{ ...m, summary: m.summary, importance: m.importance }] : []
    ),
    weekStart: window.startIso,
    weekEnd: window.endIso,
    appUrl: site ? `${site}/dashboard` : undefined,
  });

  const ok = await sendEmail(owner.email, digest.subject, digest.text);
  if (!ok) {
    await release();
    return "failed";
  }
  return "sent";
}
