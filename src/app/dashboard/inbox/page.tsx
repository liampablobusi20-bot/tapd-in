import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureInboxToken } from "@/lib/actions/inbox";
import { formatRelativeTime } from "@/lib/format-relative-time";
import {
  CategoryForm,
  CopyAddress,
  RemoveButton,
  SampleForm,
  TestDigestButton,
} from "./inbox-forms";

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("inbox_enabled")
    .eq("id", user.id)
    .single();
  if (!profile?.inbox_enabled) redirect("/dashboard");

  const token = await ensureInboxToken();
  const domain = process.env.INBOX_DOMAIN;

  const [{ data: categories }, { data: messages }] = await Promise.all([
    supabase
      .from("inbox_categories")
      .select("id, name, description")
      .order("sort_order", { ascending: true }),
    supabase
      .from("inbox_messages")
      .select("id, sender_name, sender_address, subject, summary, importance, status, skip_reason, category_id, received_at")
      .neq("status", "skipped")
      .order("received_at", { ascending: false })
      .limit(40),
  ]);
  const names = new Map((categories ?? []).map((c) => [c.id, c.name]));

  const section = "mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm";
  const heading = "text-base font-semibold text-zinc-900";
  const hint = "mt-1 text-sm text-zinc-600";

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-semibold text-zinc-900">Inbox</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Messages are sorted into your categories and summarized. You get one update each Monday.
      </p>

      <section className={section}>
        <h2 className={heading}>Your forwarding address</h2>
        <p className={hint}>
          Forward the email you want included to this address. Keep it private: anyone with it can add
          messages.
        </p>
        <div className="mt-3">
          {domain ? (
            <CopyAddress address={`${token}@${domain}`} />
          ) : (
            <p className="text-sm text-amber-700">The receiving address isn&apos;t set up yet.</p>
          )}
        </div>
      </section>

      <section className={section}>
        <h2 className={heading}>Categories</h2>
        <p className={hint}>Describe each one in a few words so messages land in the right place.</p>
        <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
          {categories?.map((category) => (
            <li key={category.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900">{category.name}</p>
                {category.description && (
                  <p className="text-sm text-zinc-500">{category.description}</p>
                )}
              </div>
              <RemoveButton id={category.id} kind="category" label="Remove" />
            </li>
          ))}
          {categories?.length === 0 && (
            <li className="py-2 text-sm text-zinc-500">
              No categories yet. Messages will go under &quot;Other&quot;.
            </li>
          )}
        </ul>
        <CategoryForm />
      </section>

      <section className={section}>
        <h2 className={heading}>Try it</h2>
        <p className={hint}>Paste a message to see how it gets sorted and summarized.</p>
        <SampleForm />
        <TestDigestButton />
      </section>

      <section className={section}>
        <h2 className={heading}>Recent messages</h2>
        <ul className="mt-3 flex flex-col divide-y divide-zinc-100">
          {messages?.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-zinc-900">
                  <span className="font-semibold">{m.sender_name || m.sender_address || "Someone"}</span>
                  {m.importance === "urgent" && (
                    <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      Urgent
                    </span>
                  )}
                </p>
                <p className="text-sm text-zinc-700">
                  {m.status === "pending"
                    ? "Sorting…"
                    : m.status === "failed"
                      ? "Couldn't be read"
                      : m.summary}
                </p>
                <p className="text-xs text-zinc-500">
                  {m.category_id ? names.get(m.category_id) ?? "Other" : "Other"} ·{" "}
                  {formatRelativeTime(new Date(m.received_at))}
                </p>
              </div>
              <RemoveButton id={m.id} kind="message" label="Not business" />
            </li>
          ))}
          {messages?.length === 0 && (
            <li className="py-2 text-sm text-zinc-500">Nothing yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
