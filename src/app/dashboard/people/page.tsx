import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eyebrow } from "@/components/ui";
import { formatPhone } from "@/lib/inbox/texts";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { groupPeople } from "@/lib/inbox/people";
import { PeopleList } from "./people-list";

const ninetyDaysAgo = () => new Date(Date.now() - 90 * 86_400_000).toISOString();

export default async function PeoplePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("inbox_messages")
    .select("id, source, sender_name, sender_address, summary, importance, received_at, needs_reply, resolved_at, answered_at")
    .eq("status", "processed")
    .gte("received_at", ninetyDaysAgo())
    .order("received_at", { ascending: false })
    .limit(2000);

  const people = groupPeople(data ?? [], formatPhone).map((p) => ({
    key: p.key,
    name: p.name,
    waiting: p.waiting,
    meta: `${p.channels.join(" · ")} · ${formatRelativeTime(p.lastAt)}`,
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
      <p className={eyebrow}>Last 90 days</p>
      <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">People</h1>
      <p className="mt-4 max-w-lg text-muted">Everyone you&apos;ve heard from, with their emails and texts together.</p>
      <div className="mt-10">
        {people.length > 0 ? (
          <PeopleList people={people} />
        ) : (
          <p className="rounded-3xl border border-line bg-card p-8 text-muted">No one yet. People appear here as mail and texts arrive.</p>
        )}
      </div>
    </div>
  );
}
