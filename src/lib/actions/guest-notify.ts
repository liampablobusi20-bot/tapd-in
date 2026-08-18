"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGuestLink } from "@/lib/guest";

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type GuestNotifyState = { error?: string } | undefined;

export async function setGuestSmsNotify(
  token: string,
  _prevState: GuestNotifyState,
  formData: FormData
): Promise<GuestNotifyState> {
  const link = await resolveGuestLink(token);
  if (!link) throw new Error("Not found.");

  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  if (!phone) return { error: "Enter a valid 10-digit phone number." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("guest_links")
    .update({ phone, notify_via: "sms" })
    .eq("token", token);
  if (error) return { error: error.message };

  revalidatePath(`/c/${token}`);
}

export async function setGuestEmailNotify(
  token: string,
  _prevState: GuestNotifyState,
  formData: FormData
): Promise<GuestNotifyState> {
  const link = await resolveGuestLink(token);
  if (!link) throw new Error("Not found.");

  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("guest_links")
    .update({ email, notify_via: "email" })
    .eq("token", token);
  if (error) return { error: error.message };

  revalidatePath(`/c/${token}`);
}

export async function clearGuestNotify(token: string) {
  const link = await resolveGuestLink(token);
  if (!link) throw new Error("Not found.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("guest_links")
    .update({ notify_via: null })
    .eq("token", token);
  if (error) throw new Error(error.message);

  revalidatePath(`/c/${token}`);
}
