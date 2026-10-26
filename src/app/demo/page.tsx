import type { Metadata } from "next";
import Link from "next/link";
import { btnPrimary, btnSecondary, eyebrow, Wordmark } from "@/components/ui";
import { composeDigest, type DigestMessage } from "@/lib/inbox/digest";

export const metadata: Metadata = {
  title: "See a sample briefing",
  description: "A look at what a Tapd In briefing contains, using sample messages.",
  robots: { index: false },
};

type Source = "email" | "text";
type Item = {
  who: string;
  when: string;
  iso: string;
  source: Source;
  topic: string;
  urgent?: boolean;
  // Someone is waiting on the reader for a reply.
  waiting?: boolean;
  summary: string;
  whole?: string;
  count?: number;
};

// Every name and message here is made up. Nothing on this page is real data.
const items: Item[] = [
  {
    who: "Dana Ruiz",
    iso: "2026-10-23T19:00:00Z",
    when: "Fri, Oct 23",
    source: "email",
    topic: "Clients",
    urgent: true,
    waiting: true,
    summary: "The revised Harbor contract needs your signature by Friday, or the 12% discount expires.",
  },
  {
    who: "Marcus Lee",
    iso: "2026-10-23T17:00:00Z",
    when: "Fri, Oct 23",
    source: "text",
    topic: "Team",
    urgent: true,
    waiting: true,
    summary: "The crane inspection failed this morning. He wants approval to reschedule and asks who to call.",
    count: 4,
    whole:
      "Marcus reported the crane inspection failed and asked to move the pour to Monday. He later said the inspector can return Monday at 7am, and that the concrete supplier agreed to hold the order. He's waiting for your go-ahead.",
  },
  {
    who: "Priya Shah",
    iso: "2026-10-22T19:00:00Z",
    when: "Thu, Oct 22",
    source: "email",
    topic: "Clients",
    waiting: true,
    summary: "Asked to move the quarterly review from the 21st to the 24th and sent two possible times.",
  },
  {
    who: "Sam Ortiz",
    iso: "2026-10-17T18:00:00Z",
    when: "Sat, Oct 17",
    source: "text",
    topic: "Clients",
    waiting: true,
    summary: "Still waiting on your go-ahead for the Henderson job. The crew is on hold until they hear from you.",
  },
  {
    who: "Alvaro Reyes",
    iso: "2026-10-22T16:00:00Z",
    when: "Thu, Oct 22",
    source: "text",
    topic: "Vendors",
    summary: "Asking for the total on the water filtration quote and whether it includes installation.",
  },
  {
    who: "Harbor Print",
    iso: "2026-10-21T19:00:00Z",
    when: "Wed, Oct 21",
    source: "email",
    topic: "Vendors",
    summary: "Proofs are approved and the order ships Thursday. The invoice is $4,180, due in 30 days.",
  },
  {
    who: "Jenna Cole",
    iso: "2026-10-21T16:00:00Z",
    when: "Wed, Oct 21",
    source: "email",
    topic: "Team",
    summary: "Sent the updated hiring plan for Q1. Wants your comments before Tuesday's leadership meeting.",
  },
];

const topics = ["Clients", "Team", "Vendors"];
// The page and the sample email both measure waiting from the same moment.
const DEMO_NOW = Date.parse("2026-10-26T07:00:00Z");
const waitingDays = (item: Item) => Math.max(0, Math.floor((DEMO_NOW - Date.parse(item.iso)) / 86_400_000));
const waiting = items.filter((i) => i.waiting).sort((a, b) => waitingDays(b) - waitingDays(a));
const urgent = items.filter((i) => i.urgent && !i.waiting);
const rest = items.filter((i) => !i.urgent && !i.waiting);

// The Monday email, built by the same code that builds the real one.
const toDigest = (item: Item): DigestMessage => ({
  id: item.who,
  category_id: item.topic,
  sender_name: item.who,
  sender_address: null,
  summary: item.summary,
  importance: item.urgent ? "urgent" : "normal",
  received_at: item.iso,
});
const digestMessages: DigestMessage[] = items.map(toDigest);
const digest = composeDigest({
  name: "Ava",
  categories: topics.map((name, i) => ({ id: name, name, sort_order: i })),
  messages: digestMessages,
  waiting: waiting.map(toDigest),
  weekStart: "2026-10-19T07:00:00Z",
  weekEnd: "2026-10-26T07:00:00Z",
});

function Row({ item }: { item: Item }) {
  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <p className="text-[15px] leading-snug">
        <span className="font-semibold">{item.who}</span>
        <span className="text-faint"> · {item.when}</span>
        <span className="text-faint"> · {item.source === "text" ? "Text" : "Email"}</span>
        <span className="text-faint"> · {item.topic}</span>
        {item.urgent && (
          <span className="ml-2 rounded-full bg-alert-soft px-2 py-0.5 align-middle text-[11px] font-medium text-alert">Urgent</span>
        )}
        {item.waiting && (
          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-[11px] font-medium text-accent">
            {waitingDays(item) === 0 ? "Today" : `Waiting ${waitingDays(item)} ${waitingDays(item) === 1 ? "day" : "days"}`}
          </span>
        )}
      </p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{item.summary}</p>
      {item.whole && (
        <div className="mt-3 rounded-2xl bg-paper p-4 text-sm leading-relaxed">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Whole conversation ({item.count} texts)</p>
          <p className="mt-2 text-muted">{item.whole}</p>
        </div>
      )}
      {!item.whole && item.count && (
        <p className="mt-3 text-xs font-medium text-faint">Summarize the conversation ({item.count} texts)</p>
      )}
      <p className="mt-3 flex gap-5 text-xs font-medium text-faint">
        {item.waiting && <span className="text-ink">Done</span>}
        <span>Reply</span>
      </p>
    </li>
  );
}

export default function DemoPage() {
  const card = "mt-5 divide-y divide-line rounded-3xl border border-line bg-card p-7 sm:p-8";
  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Wordmark />
        <Link href="/signup" className={btnPrimary}>
          Request access
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8 sm:pt-14">
        <p className="rounded-2xl bg-accent-soft px-5 py-3 text-sm text-accent">
          Sample data. Every name and message on this page is made up, to show what a briefing looks like.
        </p>

        <p className={`${eyebrow} mt-10`}>Last 7 days</p>
        <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">Ava, here&apos;s your week.</h1>
        <p className="mt-6 text-muted">
          <span className="font-medium text-accent">{waiting.length} waiting on you</span> · {items.length} messages sorted from Outlook and texts
          {urgent.length > 0 && (
            <>
              {" "}
              · <span className="font-medium text-alert">{urgent.length} urgent</span>
            </>
          )}
        </p>

        <div className="mt-12 flex flex-col gap-12">
          <section>
            <p className={`${eyebrow} text-accent`}>Waiting on you</p>
            <ul className={`${card} border-accent/25`}>
              {waiting.map((item) => (
                <Row key={item.who} item={item} />
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">
              Tapd In notices who is waiting on a reply from you. They drop off once you answer in Outlook, or when you tap Done.
            </p>
          </section>
          {urgent.length > 0 && (
            <section>
              <p className={`${eyebrow} text-alert`}>Needs your attention</p>
              <ul className={`${card} border-alert/20`}>
                {urgent.map((item) => (
                  <Row key={item.who} item={item} />
                ))}
              </ul>
            </section>
          )}
          {topics.map((topic) => {
            const list = rest.filter((i) => i.topic === topic);
            return list.length ? (
              <section key={topic}>
                <p className={eyebrow}>{topic}</p>
                <ul className={card}>
                  {list.map((item) => (
                    <Row key={item.who} item={item} />
                  ))}
                </ul>
              </section>
            ) : null;
          })}
        </div>

        <section className="mt-20">
          <p className={eyebrow}>Every Monday</p>
          <h2 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">It also arrives by email.</h2>
          <p className="mt-4 max-w-lg text-muted">The same week, as one calm email. Urgent items first, then each topic.</p>
          <div className="mt-8 rounded-3xl border border-line bg-card p-7 shadow-[0_30px_60px_-30px_rgba(27,26,23,0.25)] sm:p-9">
            <p className="text-xs text-faint">From Tapd In · Monday 7:00 AM</p>
            <p className="mt-2 font-semibold">{digest.subject}</p>
            <pre className="mt-5 whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-muted">{digest.text}</pre>
          </div>
        </section>

        <section className="mt-20 rounded-3xl bg-accent px-8 py-12 text-paper sm:px-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-paper/60">Setup takes minutes</p>
          <div className="mt-6 grid gap-8 sm:grid-cols-3">
            {[
              ["Connect Outlook", "Sign in with Microsoft. Read-only: it can't send, delete or change anything."],
              ["Pick your texts", "On your iPhone, choose whose texts count. Everyone else's stay on your phone."],
              ["Read it Monday", "One briefing for the week, with anything urgent at the top."],
            ].map(([title, body]) => (
              <div key={title}>
                <h3 className="font-display text-2xl tracking-tight">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-paper/75">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <Link href="/signup" className={btnPrimary}>
            Request access
          </Link>
          <Link href="/guide" className={btnSecondary}>
            Read the setup guide
          </Link>
          <Link href="/" className={btnSecondary}>
            Back to the homepage
          </Link>
        </div>
      </main>
    </div>
  );
}
