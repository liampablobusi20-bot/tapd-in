"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/inbox/activity-log";
import { deviceLabel } from "@/lib/inbox/activity";

export type AuthState =
  | { error?: string; needsConfirmation?: boolean; sent?: boolean }
  | undefined;

export async function signup(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  // If "Confirm email" is enabled in Supabase, signUp() succeeds but
  // doesn't create a session until the user clicks the emailed link —
  // don't redirect somewhere that needs auth in that case.
  if (!data.session) {
    return { needsConfirmation: true };
  }

  redirect("/dashboard");
}

export async function login(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // With two-step sign-in on, the password alone isn't enough: ask for the code next.
  const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (level?.nextLevel === "aal2" && level.currentLevel !== "aal2") redirect("/login/verify");

  if (data.user) await logActivity(data.user.id, "signed_in", deviceLabel((await headers()).get("user-agent")));
  redirect("/dashboard");
}

// The second step of signing in, for accounts with two-step sign-in on.
export async function verifyLogin(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  // Only places inside the app are allowed as a destination.
  const requested = String(formData.get("next") ?? "");
  const destination = requested === "/reset-password" ? requested : "/dashboard";
  const device = deviceLabel((await headers()).get("user-agent"));
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) redirect("/dashboard");

  const failed = { error: "That code didn't work. Check the 6 digits in your app and try again." };
  if (!/^\d{6}$/.test(code)) return failed;
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) {
    await logActivity(user.id, "two_step_failed", device);
    return failed;
  }

  await logActivity(user.id, "signed_in", `${device}, two-step`);
  redirect(destination);
}

// Sends a password-reset link. The answer is the same whether or not the address has an
// account, so this can't be used to find out who has one.
export async function requestPasswordReset(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email || !email.includes("@")) return { error: "Enter the email you signed up with." };

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/auth/confirm?next=/reset-password`,
  });
  if (error?.status === 429) return { error: "Too many requests. Please wait a few minutes and try again." };
  if (error) console.error("Password reset request failed:", error.message);
  return { sent: true };
}

// Sets the new password. They arrive here signed in by the emailed link; any other
// sessions are signed out, so whoever had the old password is shut out.
export async function updatePassword(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=reset-failed");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  await supabase.auth.signOut({ scope: "others" });
  await logActivity(user.id, "password_changed", deviceLabel((await headers()).get("user-agent")));
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
