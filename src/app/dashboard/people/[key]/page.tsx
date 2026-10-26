import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { eyebrow } from "@/components/ui";
import { formatPhone, replyLink } from "@/lib/inbox/texts";
import { messagesFor, isWaiting, groupPeople, type PersonMessage } from "@/lib/inbox/people";
import { DoneButton } from "../../inbox-forms";
import { CatchMeUpButton } from "../../texts-forms";

const ninetyDaysAgo = () => new Date(Date.now() - 90 * 86_400_000).toISOString();
const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Phoenix" });

function replyFor(m: PersonMessage) {
  if (m.source === "sms") return replyLink(m.sender_address);
  return m.sender_address ? `mailto:${m.sender_address}` : null;
}

export default async function PersonPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);

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

  const all = (data ?? []) as PersonMessage[];
  const mine = messagesFor(all, key);
  if (mine.length === 0) notFound();

  const person = groupPeople(mine, formatPhone)[0];
  const waiting = mine.filter(isWaiting).reverse();
  const FIRST = 12;
  const recent = mine.slice(0, FIRST);
  const earlier = mine.slice(FIRST);

  const Item = ({ m }: { m: PersonMessage }) => (
    <li className="py-4 first:pt-0 last:pb-0">
      <p className="text-xs text-faint">
        {dateLabel(m.received_at)} · {m.source === "sms" ? "Text" : "Email"}
      </p>
      <p className="mt-1 text-[15px] leading-relaxed text-muted">{m.summary}</p>
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
      <Link href="/dashboard/people" className="text-sm text-muted hover:text-ink">
        ← People
      </Link>
      <h1 className="mt-8 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">{person.name}</h1>
      <p className="mt-4 text-muted">
        {person.count} {person.count === 1 ? "message" : "messages"} · {person.channels.join(" and ")}
        {waiting.length > 0 && (
          <>
            {" "}
            · <span className="font-medium text-accent">{waiting.length} waiting on you</span>
          </>
        )}
      </p>

      <div className="mt-8">
        <CatchMeUpButton personKey={key} />
      </div>

      {waiting.length > 0 && (
        <section className="mt-12">
          <p className={`${eyebrow} text-accent`}>Waiting on you</p>
          <ul className="mt-5 divide-y divide-line rounded-3xl border border-accent/25 bg-card p-7 sm:p-8">
            {waiting.map((m) => {
              const days = daysSince(m.received_at);
              const reply = replyFor(m);
              return (
                <li key={m.id} className="py-4 first:pt-0 last:pb-0">
                  <p className="text-xs text-faint">
                    {days === 0 ? "Today" : `Waiting ${days} ${days === 1 ? "day" : "days"}`} · {m.source === "sms" ? "Text" : "Email"}
                  </p>
                  <p className="mt-1 text-[15px] leading-relaxed text-muted">{m.summary}</p>
                  <div className="mt-3 flex items-center gap-5 text-xs text-faint">
                    <DoneButton id={m.id} />
                    {reply && (
                      <a href={reply} className="font-medium transition-colors hover:text-ink">
                        Reply
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <p className={eyebrow}>Timeline</p>
        <ul className="mt-5 divide-y divide-line rounded-3xl border border-line bg-card p-7 sm:p-8">
          {recent.map((m) => (
            <Item key={m.id} m={m} />
          ))}
        </ul>
        {earlier.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">Show {earlier.length} earlier</summary>
            <ul className="mt-4 divide-y divide-line rounded-3xl border border-line bg-card p-7 sm:p-8">
              {earlier.map((m) => (
                <Item key={m.id} m={m} />
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
