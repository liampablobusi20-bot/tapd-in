"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const FREE_PLAN_CALENDAR_LIMIT = 1;

export type CreateCalendarState = { error?: string } | undefined;

export async function createCalendar(
  _prevState: CreateCalendarState,
  formData: FormData
): Promise<CreateCalendarState> {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const { data: profile } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profile?.plan === "free") {
    const { count } = await supabase
      .from("calendars")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);

    if ((count ?? 0) >= FREE_PLAN_CALENDAR_LIMIT) {
      // TODO(stripe): once billing is wired up, this is where we'd create a
      // Stripe Checkout Session for the Pro price and redirect the user
      // there instead of just blocking. See src/app/api/webhooks/stripe
      // for where a successful payment would flip `users.plan` /
      // `users.subscription_status`.
      return {
        error:
          "Free plan is limited to 1 calendar. Upgrade to Pro to create more.",
      };
    }
  }

  const { data, error } = await supabase
    .from("calendars")
    .insert({ name, owner_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create calendar." };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/calendars/${data.id}`);
}

export async function renameCalendar(calendarId: string, name: string) {
  const { supabase } = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) return;

  // RLS (owner_id = auth.uid()) enforces that this only affects a
  // calendar the current user owns.
  const { error } = await supabase
    .from("calendars")
    .update({ name: trimmed })
    .eq("id", calendarId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/calendars/${calendarId}`);
}

export async function deleteCalendar(calendarId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("calendars")
    .delete()
    .eq("id", calendarId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
