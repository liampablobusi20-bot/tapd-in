import { Wordmark } from "@/components/ui";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      <Wordmark className="mb-10" />
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 shadow-[0_1px_2px_rgba(27,26,23,0.04),0_12px_32px_-12px_rgba(27,26,23,0.12)]">
        <h1 className="font-display text-3xl tracking-tight">Request access</h1>
        <p className="mt-1.5 text-sm text-muted">
          Create an account and we&apos;ll switch your briefing on.
        </p>
        <div className="mt-6">
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
