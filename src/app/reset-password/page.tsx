import { redirect } from "next/navigation";
import { Wordmark } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=reset-failed");

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      <Wordmark className="mb-10" />
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 shadow-[0_1px_2px_rgba(27,26,23,0.04),0_12px_32px_-12px_rgba(27,26,23,0.12)]">
        <h1 className="font-display text-3xl tracking-tight">Choose a new password</h1>
        <p className="mt-1.5 text-sm text-muted">At least 8 characters. You&apos;ll be signed out everywhere else.</p>
        <div className="mt-6">
          <ResetForm />
        </div>
      </div>
    </div>
  );
}
