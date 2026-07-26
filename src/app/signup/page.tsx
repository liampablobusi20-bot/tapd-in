import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Tapd In</h1>
        <p className="mb-6 text-sm text-zinc-600">
          Create an account to start a project calendar.
        </p>
        <SignupForm />
      </div>
    </div>
  );
}
