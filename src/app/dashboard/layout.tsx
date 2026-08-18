import { logout } from "@/lib/actions/auth";
import { AddToHomeScreenButton } from "@/components/add-to-home-screen-button";
import { DashboardMenu } from "./dashboard-menu";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("users")
        .select("plan, subscription_status")
        .eq("id", user.id)
        .single()
    : { data: null };

  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 shadow-sm">
        <DashboardMenu
          plan={profile?.plan ?? "free"}
          subscriptionStatus={profile?.subscription_status ?? "trialing"}
        />
        <div className="flex items-center gap-4">
          <AddToHomeScreenButton className="text-sm font-medium text-zinc-600 hover:text-zinc-900" />
          <form action={logout}>
            <button
              type="submit"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
