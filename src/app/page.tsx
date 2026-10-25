import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { btnPrimary, btnSecondary, eyebrow, Wordmark } from "@/components/ui";

const steps = [
  {
    n: "01",
    title: "Connect Outlook",
    body: "Sign in with Microsoft once. Tapd In gets read-only access to your inbox, so it can read but never send, delete, or change anything.",
  },
  {
    n: "02",
    title: "Pick the texts that matter",
    body: "On your iPhone, choose the people whose texts count as business. Everyone else's texts stay on your phone.",
  },
  {
    n: "03",
    title: "Read it Monday",
    body: "One calm email with your week laid out by topic: who said what, by email or text, with anything urgent at the top.",
  },
];

const principles = [
  {
    title: "Only Outlook and the texts you pick",
    body: "It reads your Outlook inbox and texts from the people you choose. Nothing else, and nothing you don't connect.",
  },
  {
    title: "Summaries, not archives",
    body: "Once a message is summarized, its text is deleted. We keep the summary and who it was from.",
  },
  {
    title: "Written by an AI, said plainly",
    body: "Summaries are produced by Claude, an AI model from Anthropic. Reply from your own inbox and phone, as you always have.",
  },
];

type ExampleItem = { who: string; day: string; text: string; urgent?: boolean; via?: string };

const example: { topic: string; items: ExampleItem[] }[] = [
  {
    topic: "Clients",
    items: [
      { who: "Dana Ruiz", day: "Thu", urgent: true, text: "The revised contract needs your signature by Friday or the 12% discount expires." },
      { who: "Priya Shah", day: "Tue", via: "Text", text: "Asked to move the quarterly review to the 24th." },
    ],
  },
  {
    topic: "Team",
    items: [
      { who: "Marcus Lee", day: "Wed", via: "Text", text: "Can't make the 3pm staff meeting; suggests Friday morning instead." },
    ],
  },
  {
    topic: "Vendors",
    items: [
      { who: "Harbor Print", day: "Mon", text: "Proofs are approved and the order ships Thursday." },
    ],
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <Wordmark />
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/login" className="text-muted transition-colors hover:text-ink">
            Log in
          </Link>
          <Link href="/signup" className={btnPrimary}>
            Request access
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 sm:px-10 sm:pb-28 sm:pt-24">
          <p className={eyebrow}>A weekly briefing for busy people</p>
          <h1 className="mt-6 max-w-4xl font-display text-[44px] leading-[1.02] tracking-tight sm:text-7xl lg:text-[88px]">
            Everything that mattered this week.{" "}
            <span className="italic text-accent">One email.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
            Tapd In reads your Outlook email and the texts you choose, sorts them by topic, and sends a
            short briefing every Monday: who said what, and what&apos;s waiting on you.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/signup" className={`${btnPrimary} px-7 py-3.5 text-[15px]`}>
              Request access
            </Link>
            <Link href="/demo" className={`${btnSecondary} px-7 py-3.5 text-[15px]`}>
              See a sample briefing
            </Link>
          </div>
        </section>

        <section id="example" className="border-y border-line bg-[#f3efe7] px-6 py-20 sm:px-10 sm:py-28">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
            <div>
              <p className={eyebrow}>What lands in your inbox</p>
              <h2 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
                A briefing you can read in two minutes.
              </h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">
                Emails and texts, grouped by the topics you care about. Urgent items first. Every line names
                the person and the point, so you never have to open the thread to know where things stand.
              </p>
            </div>

            <div className="rounded-3xl border border-line bg-card p-7 shadow-[0_1px_2px_rgba(27,26,23,0.04),0_30px_60px_-30px_rgba(27,26,23,0.25)] sm:p-9">
              <div className="flex items-baseline justify-between gap-4 border-b border-line pb-5">
                <p className="font-display text-2xl tracking-tight">Your week</p>
                <p className="text-xs text-faint">Oct 5 – Oct 11</p>
              </div>
              <div className="mt-6 flex flex-col gap-7">
                {example.map((group) => (
                  <div key={group.topic}>
                    <p className={eyebrow}>{group.topic}</p>
                    <ul className="mt-3 flex flex-col gap-3.5">
                      {group.items.map((item) => (
                        <li key={item.who} className="text-[15px] leading-relaxed">
                          <span className="font-semibold">{item.who}</span>
                          <span className="text-faint"> · {item.day}</span>
                          {item.via && <span className="text-faint"> · {item.via}</span>}
                          {item.urgent && (
                            <span className="ml-2 rounded-full bg-alert-soft px-2 py-0.5 align-middle text-[11px] font-medium text-alert">
                              Urgent
                            </span>
                          )}
                          <span className="mt-0.5 block text-muted">{item.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-8 border-t border-line pt-4 text-xs text-faint">Illustrative example</p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
          <p className={eyebrow}>How it works</p>
          <div className="mt-10 grid gap-12 sm:grid-cols-3 sm:gap-10">
            {steps.map((step) => (
              <div key={step.n}>
                <p className="font-display text-5xl italic text-accent/40">{step.n}</p>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24 sm:px-10 sm:pb-32">
          <div className="rounded-3xl bg-accent px-8 py-14 text-paper sm:px-14 sm:py-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-paper/60">
              Private by design
            </p>
            <div className="mt-8 grid gap-10 sm:grid-cols-3 sm:gap-12">
              {principles.map((item) => (
                <div key={item.title}>
                  <h3 className="font-display text-2xl leading-tight tracking-tight">{item.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-paper/75">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-28 text-center sm:px-10 sm:pb-36">
          <h2 className="mx-auto max-w-2xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            Spend Monday catching up on decisions, not inboxes.
          </h2>
          <div className="mt-10">
            <Link href="/signup" className={`${btnPrimary} px-8 py-3.5 text-[15px]`}>
              Request access
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-6 py-8 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-muted">
          <span>&copy; 2026 Tapd In</span>
          <div className="flex gap-6">
            <Link href="/guide" className="transition-colors hover:text-ink">
              Setup guide
            </Link>
            <a href="/privacy" className="transition-colors hover:text-ink">
              Privacy Policy
            </a>
            <a href="/terms" className="transition-colors hover:text-ink">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
