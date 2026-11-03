import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { Wordmark, eyebrow } from "@/components/ui";
import { getConfig } from "@/lib/inbox/config-store";
import { trialState } from "@/lib/inbox/trial";
import { billingConfigured } from "@/lib/billing/stripe";
import { formatPrice } from "@/lib/billing/checkout";
import { AccessControls, CheckoutLink, ConfigForm, PriceForm, RevertButton } from "./controls";

export const metadata = { title: "Account", robots: { index: false } };

const TZ = "America/Phoenix";
const nowMs = () => Date.now();
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });

function stateText(s: ReturnType<typeof trialState>): string {
  switch (s.state) {
    case "none": return "No trial limit (set up before trials existed)";
    case "paid": return "Paying";
    case "trial": return `Free trial: ${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"} left${s.cardOnFile ? " (card on file, billing starts when it ends)" : " (no card yet)"}`;
    case "grace": return `Trial ended. ${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"} of grace left before pausing`;
    case "payment_issue": return `Payment failed. ${s.daysLeft} ${s.daysLeft === 1 ? "day" : "days"} left before pausing`;
    case "paused": return `Paused (${s.reason.replace("_", " ")})`;
  }
}

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) notFound();

  const admin = createAdminClient();
  const { data: account } = await admin
    .from("users")
    .select("id, email, created_at, inbox_enabled, subscription_status, trial_ends_at, stripe_subscription_id, stripe_customer_id, billing_issue_at, monthly_price_cents")
    .eq("id", id)
    .maybeSingle();
  if (!account) notFound();

  const [config, { data: history }] = await Promise.all([
    getConfig(id),
    admin.from("account_config_history").select("id, changed_at, changed_by, note, before, after").eq("owner_id", id).order("changed_at", { ascending: false }).limit(15),
  ]);
  const state = trialState(account, nowMs());
  const card = "mt-5 rounded-3xl border border-line bg-card p-7 sm:p-8";

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Wordmark href="/dashboard" />
        <Link href="/admin" className="text-sm text-muted transition-colors hover:text-ink">
          ← All accounts
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <p className={eyebrow}>Account</p>
        <h1 className="mt-4 break-all font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">{account.email}</h1>
        <p className="mt-3 text-sm text-muted">
          Changes here apply to this account only. Nothing you change affects anyone else.
        </p>

        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">Trial and billing</h2>
          <div className={card}>
            <p className="font-medium">{stateText(state)}</p>
            {account.trial_ends_at && state.state !== "paid" && <p className="mt-1 text-sm text-muted">Trial end: {when(account.trial_ends_at)}</p>}
            <div className="mt-5 flex flex-col gap-5 border-t border-line pt-5">
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted">Monthly price</p>
                <PriceForm userId={id} current={account.monthly_price_cents ? String(account.monthly_price_cents / 100) : ""} />
                {account.monthly_price_cents && <p className="mt-1.5 text-xs text-faint">Currently {formatPrice(account.monthly_price_cents)}</p>}
              </div>
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted">Access</p>
                <AccessControls userId={id} />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted">Payment</p>
                {billingConfigured() ? <CheckoutLink userId={id} /> : <p className="text-sm text-muted">Stripe isn&apos;t connected yet. Add the Stripe keys to turn online payment on.</p>}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">Customize for this person</h2>
          <div className={card}>
            <ConfigForm userId={id} config={config} />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight">Change history</h2>
          <ul className={`${card} divide-y divide-line`}>
            {(history ?? []).map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">{when(h.changed_at)} · {h.changed_by}</p>
                  {h.note && <p className="mt-0.5 text-muted">{h.note}</p>}
                </div>
                <RevertButton userId={id} historyId={h.id} />
              </li>
            ))}
            {(history ?? []).length === 0 && <li className="text-sm text-muted">No changes yet. This account uses the standard settings.</li>}
          </ul>
        </section>
      </main>
    </div>
  );
}
