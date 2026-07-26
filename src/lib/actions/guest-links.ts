"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function currentOrigin() {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const protocol =
    hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export type GuestLinkState = { url?: string; error?: string } | undefined;

export async function createGuestLink(
  calendarId: string,
  _prevState: GuestLinkState,
  formData: FormData
): Promise<GuestLinkState> {
  const { supabase, user } = await requireUser();

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("id", calendarId)
    .maybeSingle();
  if (!calendar) return { error: "Calendar not found." };

  const permission = String(formData.get("permission") ?? "view");
  if (permission !== "view" && permission !== "comment") {
    return { error: "Invalid permission." };
  }

  const contactName = String(formData.get("contact_name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;

  const token = crypto.randomUUID().replace(/-/g, "");

  const { error } = await supabase.from("guest_links").insert({
    calendar_id: calendarId,
    token,
    permission,
    contact_name: contactName,
    phone,
    email,
  });

  if (error) return { error: error.message };

  if (contactName || phone || email) {
    let existingId: string | null = null;

    if (email) {
      const { data } = await supabase
        .from("contacts")
        .select("id")
        .eq("owner_id", user.id)
        .eq("email", email)
        .maybeSingle();
      existingId = data?.id ?? null;
    }
    if (!existingId && phone) {
      const { data } = await supabase
        .from("contacts")
        .select("id")
        .eq("owner_id", user.id)
        .eq("phone", phone)
        .maybeSingle();
      existingId = data?.id ?? null;
    }

    const now = new Date().toISOString();
    if (existingId) {
      await supabase
        .from("contacts")
        .update({ name: contactName, phone, email, last_invited_at: now })
        .eq("id", existingId);
    } else {
      await supabase.from("contacts").insert({
        owner_id: user.id,
        name: contactName,
        phone,
        email,
        last_invited_at: now,
      });
    }
  }

  revalidatePath(`/dashboard/calendars/${calendarId}`);

  const origin = await currentOrigin();
  return { url: `${origin}/c/${token}` };
}

export async function revokeGuestLink(linkId: string, calendarId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("guest_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/calendars/${calendarId}`);
}
