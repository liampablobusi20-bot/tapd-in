import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eyebrow } from "@/components/ui";
import { describeActivity } from "@/lib/inbox/activity";

export const metadata = { title: "Account activity" };

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Owners can read their own log (and only that) with their own login.
  const { data: rows } = await supabase
    .from("inbox_activity")
    .select("id, event, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
      <Link href="/dashboard/settings" className="text-sm text-muted transition-colors hover:text-ink">
        ← Settings
      </Link>
      <p className={`${eyebrow} mt-8`}>Security</p>
      <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">Account activity</h1>
      <p className="mt-4 max-w-lg text-muted">
        Important things that happened on your account. If something here isn&apos;t you, change your password and tell us.
      </p>

      <ul className="mt-10 divide-y divide-line rounded-3xl border border-line bg-card px-7 sm:px-8">
        {rows?.map((row) => (
          <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
            <span className="text-[15px]">{describeActivity(row.event, row.detail)}</span>
            <span className="text-xs text-faint">
              {new Date(row.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                timeZone: "America/Phoenix",
              })}
            </span>
          </li>
        ))}
        {rows?.length === 0 && <li className="py-6 text-sm text-muted">Nothing recorded yet.</li>}
      </ul>
      <p className="mt-4 text-xs text-faint">Showing the last 100 events, in Arizona time. Records are kept for a year.</p>
    </div>
  );
}
