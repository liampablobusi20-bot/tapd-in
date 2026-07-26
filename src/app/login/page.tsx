import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-zinc-900">Tapd In</h1>
        <p className="mb-6 text-sm text-zinc-600">
          Log in to manage your project calendars.
        </p>
        {error === "confirmation-failed" && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            That confirmation link is invalid or expired. Try signing up
            again, or log in if you already confirmed.
          </p>
        )}
        <LoginForm />
      </div>
    </div>
  );
}
