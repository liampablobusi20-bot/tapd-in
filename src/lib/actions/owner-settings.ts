"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OwnerSettingsState = { saved?: boolean; error?: string } | undefined;

export async function updateOwnerSettings(
  _prev: OwnerSettingsState,
  formData: FormData
): Promise<OwnerSettingsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const displayName = String(formData.get("display_name") ?? "").trim().slice(0, 60);
  const notifyEmail = formData.get("notify_email") === "on";

  const { error } = await supabase
    .from("users")
    .update({ display_name: displayName || null, notify_email: notifyEmail })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save. Try again." };

  revalidatePath("/dashboard");
  return { saved: true };
}
