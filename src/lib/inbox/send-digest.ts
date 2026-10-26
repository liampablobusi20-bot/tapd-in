import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { composeDigest } from "@/lib/inbox/digest";
import { owedState, phoenixToday, worthSurfacing } from "@/lib/inbox/owed";

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

  const [{ data: categories }, { data: messages }, { data: owed }, { data: promised }] = await Promise.all([
    supabase
      .from("inbox_categories")
      .select("id, name, sort_order")
      .eq("owner_id", ownerId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("inbox_messages")
      .select("id, category_id, sender_name, sender_address, summary, importance, received_at")
      .eq("owner_id", ownerId)
      .eq("status", "processed")
      .gte("received_at", window.startIso)
      .lt("received_at", window.endIso)
      .order("received_at", { ascending: false })
      .limit(500),
    // Anyone still waiting on the owner, even from before this week.
    supabase
      .from("inbox_messages")
      .select("id, category_id, sender_name, sender_address, summary, importance, received_at")
      .eq("owner_id", ownerId)
      .eq("status", "processed")
      .eq("needs_reply", true)
      .is("resolved_at", null)
      .is("answered_at", null)
      .gte("received_at", new Date(Date.parse(window.endIso) - 30 * 86_400_000).toISOString())
      .lt("received_at", window.endIso)
      .order("received_at", { ascending: true })
      .limit(30),
    // What others promised, still open.
    supabase
      .from("inbox_messages")
      .select("sender_name, sender_address, promise, promise_due")
      .eq("owner_id", ownerId)
      .eq("status", "processed")
      .not("promise", "is", null)
      .is("promise_resolved_at", null)
      .gte("received_at", new Date(Date.parse(window.endIso) - 30 * 86_400_000).toISOString())
      .lt("received_at", window.endIso)
      .limit(100),
  ]);
  const asOfDay = phoenixToday(Date.parse(window.endIso));
  const dueSoon = (promised ?? []).flatMap((p) => {
    if (!p.promise) return [];
    const state = owedState(p.promise_due, asOfDay);
    return worthSurfacing(state) ? [{ ...p, promise: p.promise }] : [];
  });

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const digest = composeDigest({
    name: owner.display_name,
    categories: categories ?? [],
    messages: (messages ?? []).flatMap((m) =>
      m.summary && m.importance ? [{ ...m, summary: m.summary, importance: m.importance }] : []
    ),
    waiting: (owed ?? []).flatMap((m) =>
      m.summary && m.importance ? [{ ...m, summary: m.summary, importance: m.importance }] : []
    ),
    owed: dueSoon,
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
