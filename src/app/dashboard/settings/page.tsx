import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureInboxToken } from "@/lib/actions/inbox";
import { eyebrow } from "@/components/ui";
import { CategoryForm, CopyAddress, NameForm, RemoveButton } from "../inbox-forms";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const token = await ensureInboxToken();
  const domain = process.env.INBOX_DOMAIN;

  const [{ data: profile }, { data: categories }] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", user.id).single(),
    supabase.from("inbox_categories").select("id, name, description").order("sort_order", { ascending: true }),
  ]);

  const card = "mt-5 rounded-3xl border border-line bg-card p-7 sm:p-8";

  return (
    <div className="mx-auto max-w-3xl px-6 py-14 sm:py-20">
      <p className={eyebrow}>Settings</p>
      <h1 className="mt-4 font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">Your inbox</h1>

      <section className="mt-14">
        <h2 className="text-lg font-semibold tracking-tight">Forwarding address</h2>
        <p className="mt-1.5 max-w-lg text-muted">
          Forward the email you want included to this address. Keep it private: anyone who has it can add
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
