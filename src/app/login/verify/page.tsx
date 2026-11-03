import { redirect } from "next/navigation";
import { Wordmark } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "Two-step sign-in" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // Nothing to do unless this account has two-step on and hasn't finished it yet.
  if (!(level?.nextLevel === "aal2" && level.currentLevel !== "aal2")) redirect(next === "/reset-password" ? next : "/dashboard");

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      <Wordmark className="mb-10" />
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 shadow-[0_1px_2px_rgba(27,26,23,0.04),0_12px_32px_-12px_rgba(27,26,23,0.12)]">
        <h1 className="font-display text-3xl tracking-tight">One more step</h1>
        <p className="mt-1.5 text-sm text-muted">Open your authenticator app and enter the 6-digit code for Tapd In.</p>
        <div className="mt-6">
          <VerifyForm next={next === "/reset-password" ? next : undefined} />
        </div>
        <form action={logout} className="mt-6 text-center">
          <button type="submit" className="text-sm text-muted underline underline-offset-4 transition-colors hover:text-ink">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
