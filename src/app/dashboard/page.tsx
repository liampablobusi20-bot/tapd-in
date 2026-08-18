import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateCalendarForm } from "./create-calendar-form";
import { OnboardingModal } from "./onboarding-modal";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: calendars } = await supabase
    .from("calendars")
    .select("id, name, created_at")
    .eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("users")
    .select("plan, onboarded_at")
    .eq("id", user!.id)
    .single();

  const atFreeLimit =
    profile?.plan === "free" && (calendars?.length ?? 0) >= 1;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {!profile?.onboarded_at && <OnboardingModal />}
      <h1 className="text-xl font-semibold text-zinc-900">Your calendars</h1>
      <p className="mt-1 text-sm text-zinc-600">
        One calendar per project. Invite subs and clients once it&apos;s set up.
      </p>

      <ul className="mt-6 flex flex-col gap-2.5">
        {calendars?.map((calendar) => (
          <li key={calendar.id}>
            <Link
              href={`/dashboard/calendars/${calendar.id}`}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md"
            >
              <span className="font-medium text-zinc-900">
                {calendar.name}
              </span>
              <span className="text-sm text-zinc-500">
                {new Date(calendar.created_at).toLocaleDateString("en-US")}
              </span>
            </Link>
          </li>
        ))}
        {calendars?.length === 0 && (
          <li className="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500">
            No calendars yet — create your first one below.
          </li>
        )}
      </ul>

      {atFreeLimit ? (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm shadow-sm">
          <p className="font-medium text-amber-900">
            You&apos;ve reached the free plan limit (1 calendar).
          </p>
          <p className="mt-1 text-amber-800">
            Upgrade to Pro to create more projects — billing isn&apos;t wired
            up yet, so reach out for now if you need another one.
          </p>
        </div>
      ) : (
        <CreateCalendarForm />
      )}
    </div>
  );
}
