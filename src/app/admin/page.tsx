import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { Wordmark, eyebrow } from "@/components/ui";
import { gatherSnapshot } from "@/lib/inbox/health-check";
import { evaluateHealth } from "@/lib/inbox/health";
import { summarizeAccounts } from "@/lib/inbox/accounts";
import { EnableButton, TestAlertButton } from "./enable-button";

export const metadata = { title: "Status", robots: { index: false } };

const TZ = "America/Phoenix";
const nowMs = () => Date.now();
const daysAgo = (days: number) => new Date(nowMs() - days * 86_400_000).toISOString();

function ago(iso: string | null, now: number): string {
  if (!iso) return "never";
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (minutes < 2) return "just now";
  if (minutes < 90) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 36) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Anyone who isn't the administrator sees an ordinary 404.
  if (!user || !isAdmin(user.email)) notFound();

  const now = nowMs();
  const admin = createAdminClient();
  const [snapshot, { data: users }, { data: connections }, { data: messages }, { data: digests }] = await Promise.all([
    gatherSnapshot(now),
    admin.from("users").select("id, email, created_at, inbox_enabled").limit(500),
    admin.from("inbox_connections").select("owner_id, account_email, status, last_synced_at, calendar_enabled").limit(1000),
    // Only who, which channel, and when. Never any message content.
    admin.from("inbox_messages").select("owner_id, source, status, received_at").gte("received_at", daysAgo(30)).limit(20000),
    admin.from("inbox_digests").select("owner_id, week_start").gte("week_start", daysAgo(60).slice(0, 10)).limit(2000),
  ]);

  const alerts = evaluateHealth(snapshot);
  const accounts = summarizeAccounts(
    { users: users ?? [], connections: connections ?? [], messages: messages ?? [], digests: digests ?? [] },
    now
  );
  const card = "rounded-3xl border border-line bg-card p-7 sm:p-8";

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Wordmark href="/dashboard" />
        <Link href="/dashboard" className="text-sm text-muted transition-colors hover:text-ink">
          Back to briefing
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <p className={eyebrow}>Admin</p>
        <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">Status</h1>

        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">Right now</h2>
          <div className={`${card} mt-5`}>
            {alerts.length === 0 ? (
              <p className="text-[15px] text-accent">Everything looks normal.</p>
            ) : (
              <ul className="divide-y divide-line">
                {alerts.map((a) => (
                  <li key={a.key} className="py-4 first:pt-0 last:pb-0">
                    <p className={`text-[15px] font-medium ${a.level === "problem" ? "text-alert" : ""}`}>{a.title}</p>
                    <p className="mt-1 text-sm text-muted">{a.detail}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 border-t border-line pt-5">
              <TestAlertButton />
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">Accounts</h2>
          <p className="mt-1.5 text-sm text-muted">Counts and dates only. Message content is never shown here.</p>
          <ul className="mt-5 flex flex-col gap-4">
            {accounts.map((a) => (
              <li key={a.id} className={card}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.email}</p>
                    <p className="mt-0.5 text-xs text-faint">
                      Joined {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ })} ·{" "}
                      {a.enabled ? "Switched on" : "Waiting to be switched on"}
                    </p>
                  </div>
                  <EnableButton id={a.id} enabled={a.enabled} />
                </div>
                {a.enabled && (
                  <dl className="mt-5 grid gap-x-8 gap-y-3 border-t border-line pt-5 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-faint">Outlook</dt>
                      <dd>
                        {a.outlook.length === 0 && <span className="text-muted">Not connected</span>}
                        {a.outlook.map((c) => (
                          <span key={c.account} className={`block ${c.status === "active" ? "text-muted" : "text-alert"}`}>
                            {c.status === "active" ? `Checked ${ago(c.lastSyncedAt, now)}` : "Needs to reconnect"}
                            {c.calendar && " · meeting briefs on"}
                          </span>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-faint">Last text</dt>
                      <dd className="text-muted">{a.lastText ? ago(a.lastText, now) : "None in 30 days"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-faint">This week</dt>
                      <dd className="text-muted">
                        {a.messages7d} {a.messages7d === 1 ? "message" : "messages"}
                        {a.failed7d > 0 && <span className="text-alert"> · {a.failed7d} failed</span>}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-faint">Monday email</dt>
                      <dd className="text-muted">{a.lastDigest ? `Week of ${a.lastDigest}` : "None sent yet"}</dd>
                    </div>
                  </dl>
                )}
              </li>
            ))}
            {accounts.length === 0 && <li className="text-sm text-muted">No accounts yet.</li>}
          </ul>
        </section>
      </main>
    </div>
  );
}
