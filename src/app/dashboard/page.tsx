import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { btnPrimary, eyebrow } from "@/components/ui";
import { formatPhone, isNumberLabel, replyLink } from "@/lib/inbox/texts";
import { groupConversations } from "@/lib/inbox/conversations";
import { ConversationButton, NameNumber } from "./texts-forms";
import { RemoveButton, TestDigestButton } from "./inbox-forms";

const TZ = "America/Phoenix";

const sevenDaysAgo = () => new Date(Date.now() - 7 * 86_400_000).toISOString();

type Message = {
  id: string;
  source: string;
  sender_name: string | null;
  sender_address: string | null;
  subject: string | null;
  summary: string | null;
  importance: "urgent" | "normal" | "low" | null;
  status: string;
  category_id: string | null;
  received_at: string;
};

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ });
}

function replyHref(m: Message) {
  if (m.source === "sms") return replyLink(m.sender_address);
  if (!m.sender_address) return null;
  const subject = m.subject?.trim() ? `Re: ${m.subject.replace(/^re:\s*/i, "")}` : "";
  return `mailto:${m.sender_address}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}

function MessageRow({ m, tag, convoCount = 1 }: { m: Message; tag?: string; convoCount?: number }) {
  const reply = replyHref(m);
  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <p className="text-[15px] leading-snug">
        <span className="font-semibold">{m.source === "sms" && m.sender_address && isNumberLabel(m.sender_name) ? formatPhone(m.sender_address) : m.sender_name || m.sender_address || "Someone"}</span>
        <span className="text-faint"> · {dayLabel(m.received_at)}</span>
        {m.source === "sms" && <span className="text-faint"> · Text</span>}
        {tag && <span className="text-faint"> · {tag}</span>}
        {m.importance === "urgent" && (
          <span className="ml-2 rounded-full bg-alert-soft px-2 py-0.5 align-middle text-[11px] font-medium text-alert">
            Urgent
          </span>
        )}
      </p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
        {m.status === "pending" ? "Sorting…" : m.status === "failed" ? "This one couldn't be read." : m.summary}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-faint">
        {reply && (
          <a href={reply} className="font-medium transition-colors hover:text-ink">
            Reply
          </a>
        )}
        <RemoveButton id={m.id} kind="message" label="Not business" />
        {m.source === "sms" && m.sender_address && isNumberLabel(m.sender_name) && <NameNumber handle={m.sender_address} />}
        {convoCount > 1 && <ConversationButton messageId={m.id} count={convoCount} />}
      </div>
    </li>
  );
}

export default async function BriefingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const since = sevenDaysAgo();
  const [{ data: profile }, { data: categories }, { data: rows }, { count: waiting }] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", user.id).single(),
    supabase.from("inbox_categories").select("id, name").order("sort_order", { ascending: true }),
    supabase
      .from("inbox_messages")
      .select("id, source, sender_name, sender_address, subject, summary, importance, status, category_id, received_at")
      .neq("status", "skipped")
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(200),
    supabase.from("inbox_text_suggestions").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);

  const messages = (rows ?? []) as Message[];
  // Low-importance email stays out of the way. Texts are always shown, because they
  // only come from people the owner chose.
  const shown = messages.filter((m) => m.importance !== "low" || m.status !== "processed" || m.source === "sms");
  const urgent = shown.filter((m) => m.importance === "urgent");
  const convos = groupConversations(shown.filter((m) => m.source === "sms" && m.status === "processed"));
  const convoCount = (m: Message) => convos.get(m.id)?.length ?? 1;
  const rest = shown.filter((m) => m.importance !== "urgent");
  const topicName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const known = new Set((categories ?? []).map((c) => c.id));
  const sections = [
    ...(categories ?? []).map((c) => ({ key: c.id, title: c.name, items: rest.filter((m) => m.category_id === c.id) })),
    { key: "other", title: "Other", items: rest.filter((m) => !m.category_id || !known.has(m.category_id)) },
  ].filter((s) => s.items.length > 0);

  const name = profile?.display_name?.trim();

  return (
    <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className={eyebrow}>Last 7 days</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            {name ? `${name}, here's your week.` : "Your week, briefly."}
          </h1>
        </div>
        <TestDigestButton />
      </div>

      {(waiting ?? 0) > 0 && (
        <Link
          href="/dashboard/settings"
          className="mt-6 block rounded-2xl bg-accent-soft px-5 py-3 text-sm font-medium text-accent"
        >
          {waiting} new {waiting === 1 ? "number" : "numbers"} texted you. Review and add them →
        </Link>
      )}

      {shown.length > 0 && (
        <p className="mt-6 text-muted">
          {shown.length} {shown.length === 1 ? "message" : "messages"} sorted
          {urgent.length > 0 && <> · <span className="font-medium text-alert">{urgent.length} urgent</span></>}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="mt-14 rounded-3xl border border-line bg-card p-8 sm:p-12">
          <h2 className="font-display text-3xl tracking-tight">Nothing here yet.</h2>
          <p className="mt-3 max-w-md leading-relaxed text-muted">
            Set up your topics, then forward an email to your private address. It will show up here, sorted
            and summarized, within a minute.
          </p>
          <Link href="/dashboard/settings" className={`${btnPrimary} mt-8`}>
            Set up your inbox
          </Link>
        </div>
      ) : (
        <div className="mt-12 flex flex-col gap-12">
          {urgent.length > 0 && (
            <section>
              <p className={`${eyebrow} text-alert`}>Needs your attention</p>
              <ul className="mt-5 divide-y divide-line rounded-3xl border border-alert/20 bg-card p-7 sm:p-8">
                {urgent.map((m) => (
                  <MessageRow key={m.id} m={m} convoCount={convoCount(m)} tag={(m.category_id && topicName.get(m.category_id)) || undefined} />
                ))}
              </ul>
            </section>
          )}
          {sections.map((section) => (
            <section key={section.key}>
              <p className={eyebrow}>{section.title}</p>
              <ul className="mt-5 divide-y divide-line rounded-3xl border border-line bg-card p-7 sm:p-8">
                {section.items.map((m) => (
                  <MessageRow key={m.id} m={m} convoCount={convoCount(m)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
