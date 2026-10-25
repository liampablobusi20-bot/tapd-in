import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureInboxToken } from "@/lib/actions/inbox";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { btnPrimary, eyebrow } from "@/components/ui";
import { CategoryForm, CopyAddress, NameForm, RemoveButton } from "../inbox-forms";
import { ContactForm, KeyMaker, RemoveItem, SuggestionRow, SuggestionsToggle } from "../texts-forms";
import { formatPhone } from "@/lib/inbox/texts";

const CONNECT_ERRORS: Record<string, string> = {
  "needs-admin":
    "Your organization needs an administrator to approve Tapd In first. Ask your IT team to approve it, or forward your email to your Tapd In address below instead.",
  declined: "The connection wasn't approved, so nothing was connected.",
  "not-configured": "Connecting Microsoft isn't set up yet.",
  failed: "Something went wrong connecting. Please try again.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; connect_error?: string }>;
}) {
  const { connected, connect_error } = await searchParams;
  const microsoftClientId = process.env.MICROSOFT_CLIENT_ID;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const adminApprovalLink =
    microsoftClientId && siteUrl
      ? `https://login.microsoftonline.com/organizations/adminconsent?client_id=${microsoftClientId}&redirect_uri=${encodeURIComponent(`${siteUrl}/api/connect/microsoft/callback`)}`
      : null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const token = await ensureInboxToken();
  const domain = process.env.INBOX_DOMAIN;

  // Tokens live in this table, so it is read only on the server and only these columns.
  const { data: connections } = await createAdminClient()
    .from("inbox_connections")
    .select("id, account_email, status, last_synced_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  const [{ data: profile }, { data: categories }, { data: contacts }, { data: keys }, { data: suggestions }] = await Promise.all([
    supabase.from("users").select("display_name, text_suggestions").eq("id", user.id).single(),
    supabase.from("inbox_categories").select("id, name, description").order("sort_order", { ascending: true }),
    supabase.from("inbox_text_contacts").select("id, name, handle").order("name", { ascending: true }),
    supabase
      .from("inbox_text_keys")
      .select("id, key_prefix, created_at, last_used_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("inbox_text_suggestions")
      .select("id, handle, seen_count")
      .eq("status", "new")
      .order("last_seen", { ascending: false })
      .limit(50),
  ]);

  const card = "mt-5 rounded-3xl border border-line bg-card p-7 sm:p-8";

  return (
    <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
      <p className={eyebrow}>Settings</p>
      <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">Your inbox</h1>
      <p className="mt-4 text-sm text-muted">
        New here?{" "}
        <Link href="/guide" className="font-medium text-ink underline underline-offset-4">
          Read the step-by-step setup guide
        </Link>
        .
      </p>

      <section className="mt-14">
        <h2 className="text-lg font-semibold tracking-tight">Connect your email</h2>
        <p className="mt-1.5 max-w-lg text-muted">
          Connect Outlook or Microsoft 365 and new mail is sorted automatically. Access is read-only: Tapd In
          can&apos;t send, delete, or change anything in your mailbox, and you can disconnect at any time.
        </p>
        {connected && (
          <p className="mt-5 rounded-2xl bg-accent-soft px-5 py-3 text-sm text-accent">
            Connected. Your recent mail will appear in your briefing within a few minutes.
          </p>
        )}
        {connect_error && (
          <p className="mt-5 rounded-2xl bg-alert-soft px-5 py-3 text-sm text-alert">
            {CONNECT_ERRORS[connect_error] ?? CONNECT_ERRORS.failed}
          </p>
        )}
        {connect_error === "needs-admin" && adminApprovalLink && (
          <div className="mt-4 rounded-2xl border border-line bg-card p-5">
            <p className="text-sm font-medium">Send this link to your IT administrator</p>
            <p className="mt-1 text-sm text-muted">
              It lets them approve Tapd In for your whole organization in one step. After that, connect again.
            </p>
            <div className="mt-3">
              <CopyAddress address={adminApprovalLink} />
            </div>
          </div>
        )}
        <div className={card}>
          {connections && connections.length > 0 && (
            <ul className="mb-5 divide-y divide-line border-b border-line pb-1">
              {connections.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 pb-4 pt-4 first:pt-0">
                  <div className="text-sm">
                    <p className="font-medium">{c.account_email}</p>
                    <p className={c.status === "active" ? "text-xs text-faint" : "text-xs text-alert"}>
                      {c.status === "active"
                        ? c.last_synced_at
                          ? `Connected · checked ${new Date(c.last_synced_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Phoenix" })}`
                          : "Connected · first check coming up"
                        : "Needs to be reconnected"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {c.status !== "active" && (
                      <a href="/api/connect/microsoft/start" className="text-xs font-medium text-ink underline underline-offset-4">
                        Reconnect
                      </a>
                    )}
                    <RemoveItem id={c.id} kind="connection" label="Disconnect" />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <a href="/api/connect/microsoft/start" className={btnPrimary}>
            Connect Outlook / Microsoft 365
          </a>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold tracking-tight">Or forward your email</h2>
        <p className="mt-1.5 max-w-lg text-muted">
          Prefer not to connect? Forward the email you want included to this address. Keep it private: anyone who has it can add
          messages.
        </p>
        <div className={card}>
          {domain ? (
            <CopyAddress address={`${token}@${domain}`} />
          ) : (
            <p className="text-sm text-alert">The receiving address isn&apos;t set up yet.</p>
          )}
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold tracking-tight">Text messages</h2>
        <p className="mt-1.5 max-w-lg text-muted">
          Choose the people whose texts count as business on your iPhone. Only their texts are ever sent. Everyone else&apos;s stay on your
          phone. Add their names here so they show up by name.
        </p>

        <div className={card}>
          <p className="font-medium">People whose texts count</p>
          <ul className="mt-4 divide-y divide-line">
            {contacts?.map((contact) => (
              <li key={contact.id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium">{contact.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{formatPhone(contact.handle)}</p>
                </div>
                <RemoveItem id={contact.id} kind="contact" label="Remove" />
              </li>
            ))}
            {contacts?.length === 0 && (
              <li className="text-sm text-muted">No one yet. Nothing is sent until you add someone.</li>
            )}
          </ul>
          <ContactForm />
        </div>

        {profile?.text_suggestions && (
        <div className={card}>
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="font-medium">Suggest new numbers</p>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
                Off by default. When it&apos;s on, your phone tells Tapd In the phone number, never the message, of anyone not on your
                list who texts you, so you can tap Add or Ignore. That means Tapd In will see the numbers of people who text you,
                including friends and family, though never what they say.
              </p>
            </div>
            <SuggestionsToggle on={Boolean(profile?.text_suggestions)} />
          </div>
          {profile?.text_suggestions && (
            <div className="mt-5 border-t border-line pt-5">
              {suggestions && suggestions.length > 0 ? (
                <ul className="divide-y divide-line">
                  {suggestions.map((item) => (
                    <SuggestionRow key={item.id} id={item.id} label={formatPhone(item.handle)} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No new numbers yet. They&apos;ll appear here when someone not on your list texts you.</p>
              )}
            </div>
          )}
        </div>
        )}

        <div className={card}>
          <Link href="/dashboard/settings/phone" className={btnPrimary}>
            Set up texts on your iPhone
          </Link>
        </div>

        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">Advanced: use a Mac instead</summary>
        <div className={card}>
          <p className="font-medium">Your Mac</p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
            A small helper on your Mac sends texts from the people above to your inbox. It needs your iPhone
            texts to show up in Messages on your Mac, and the Mac has to be on.
          </p>
          {keys && keys.length > 0 && (
            <ul className="mt-5 divide-y divide-line border-t border-line">
              {keys.map((key) => (
                <li key={key.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="text-sm">
                    <p className="font-medium">
                      <span className="font-mono text-xs text-muted">{key.key_prefix}…</span> Mac key
                    </p>
                    <p className="text-xs text-faint">
                      {key.last_used_at
                        ? `Last used ${new Date(key.last_used_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Phoenix" })}`
                        : "Not used yet"}
                    </p>
                  </div>
                  <RemoveItem id={key.id} kind="key" label="Disconnect" />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 border-t border-line pt-5">
            <KeyMaker />
          </div>
        </div>
        </details>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold tracking-tight">Topics</h2>
        <p className="mt-1.5 max-w-lg text-muted">
          Messages are sorted into these. A short description helps each one land in the right place.
        </p>
        <div className={card}>
          <ul className="divide-y divide-line">
            {categories?.map((category) => (
              <li key={category.id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-medium">{category.name}</p>
                  {category.description && <p className="mt-0.5 text-sm text-muted">{category.description}</p>}
                </div>
                <RemoveButton id={category.id} kind="category" label="Remove" className="text-xs text-faint" />
              </li>
            ))}
            {categories?.length === 0 && (
              <li className="text-sm text-muted">No topics yet. Messages will go under &quot;Other&quot;.</li>
            )}
          </ul>
          <CategoryForm />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold tracking-tight">Your name</h2>
        <p className="mt-1.5 max-w-lg text-muted">Used to greet you at the top of your briefing.</p>
        <div className={card}>
          <NameForm defaultValue={profile?.display_name ?? ""} />
        </div>
      </section>
    </div>
  );
}
