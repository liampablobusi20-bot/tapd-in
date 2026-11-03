import { logout } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { Wordmark, btnSecondary, eyebrow } from "@/components/ui";
import { NavLinks } from "./nav-links";
import { getConfig } from "@/lib/inbox/config-store";
import { trialState } from "@/lib/inbox/trial";
import { billingConfigured } from "@/lib/billing/stripe";
import { PausedScreen, TrialBanner } from "./trial-notices";

const nowMs = () => Date.now();

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("users")
        .select("inbox_enabled, subscription_status, trial_ends_at, stripe_subscription_id, stripe_customer_id, billing_issue_at, monthly_price_cents")
        .eq("id", user.id)
        .single()
    : { data: null };
  const enabled = Boolean(profile?.inbox_enabled);
  const state = trialState(profile ?? {}, nowMs());
  const config = user && enabled ? await getConfig(user.id) : null;
  const billing = billingConfigured();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5">
          <Wordmark href="/dashboard" />
          <nav className="flex items-center gap-6 text-sm">
            {enabled && state.state !== "paused" && <NavLinks showPeople={config?.features.people ?? true} />}
            <form action={logout}>
              <button type="submit" className="text-muted transition-colors hover:text-ink">
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>

      {enabled && <TrialBanner state={state} billing={billing} />}

      <main className="flex-1">
        {enabled && state.state === "paused" ? (
          <PausedScreen reason={state.reason} billing={billing} canPay={Boolean(profile?.monthly_price_cents)} hasCustomer={Boolean(profile?.stripe_customer_id)} />
        ) : enabled ? (
          children
        ) : (
          <div className="mx-auto max-w-xl px-6 py-24 text-center">
            <p className={eyebrow}>You&apos;re on the list</p>
            <h1 className="mt-5 font-display text-5xl leading-[1.05] tracking-tight">
              We&apos;re getting your briefing ready.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              Your account is created. We&apos;ll switch on your inbox shortly and email you when it&apos;s
              ready to use.
            </p>
            <a
              href="mailto:liampablobusi20@gmail.com?subject=Tapd%20In%20access"
              className={`${btnSecondary} mt-9`}
            >
              Questions? Email us
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
