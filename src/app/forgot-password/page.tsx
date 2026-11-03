import { Wordmark } from "@/components/ui";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      <Wordmark className="mb-10" />
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-8 shadow-[0_1px_2px_rgba(27,26,23,0.04),0_12px_32px_-12px_rgba(27,26,23,0.12)]">
        <ForgotForm />
      </div>
    </div>
  );
}
