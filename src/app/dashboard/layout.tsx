import Link from "next/link";
import { logout } from "@/lib/actions/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 shadow-sm">
        <Link href="/dashboard" className="text-lg font-semibold text-zinc-900">
          Tapd In
        </Link>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
          >
            Log out
          </button>
        </form>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
