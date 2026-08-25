import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="min-h-svh bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-lg font-semibold text-zinc-900">Tapd In</span>
          <div className="flex items-center gap-4 text-sm font-medium">
            <Link href="/login" className="text-zinc-600 hover:text-zinc-900">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-white hover:bg-zinc-800"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          A shared project calendar for contractors, subs, and clients
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-600">
          Tapd In is a project calendar general contractors use to keep
          clients and subcontractors in the loop. Owners build a schedule of
          phases and dates, then share a link — Guests can view it, comment,
          and add photos without ever creating an account.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 shadow-sm hover:border-zinc-400"
          >
            Log in
          </Link>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Build a schedule
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
              Add phases with a name, target date, and notes. Owners manage
              the calendar from a simple month view or day-by-day list.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Invite without accounts
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
              Guests open a unique link to view the calendar, and — if
              permitted — post comments and photos. No sign-up required.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Text and email updates
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
              Anyone with a calendar link — Owner or Guest — can opt in to
              get a text or email whenever that project&apos;s schedule
              changes. Opt-in happens right on the calendar page: enter a
              phone number or email and tap to subscribe. Message and data
              rates may apply for texts; reply <strong>STOP</strong> to
              unsubscribe or <strong>HELP</strong> for help, at any time.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-zinc-900">
              Photos and files
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
              Attach photos, videos, or documents to any phase to keep a
              visual record of progress alongside the schedule.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200 px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
          <span>&copy; 2026 Tapd In</span>
          <div className="flex gap-4">
            <a
              href="https://tapd-in-privacy-policy-v2.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-700"
            >
              Privacy Policy
            </a>
            <a
              href="https://tapd-in-terms-of-service.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-700"
            >
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
