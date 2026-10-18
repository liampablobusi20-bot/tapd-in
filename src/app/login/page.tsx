import { Wordmark } from "@/components/ui";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      <Wordmark className="mb-10" />
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 shadow-[0_1px_2px_rgba(27,26,23,0.04),0_12px_32px_-12px_rgba(27,26,23,0.12)]">
        <h1 className="font-display text-3xl tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted">Log in to see your briefing.</p>
        {error === "confirmation-failed" && (
          <p className="mt-5 rounded-xl bg-alert-soft px-4 py-3 text-sm text-alert">
            That confirmation link is invalid or expired. Try signing up again, or log in if you
            already confirmed.
          </p>
        )}
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
