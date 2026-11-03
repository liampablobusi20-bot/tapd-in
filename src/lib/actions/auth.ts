"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/inbox/activity-log";
import { deviceLabel } from "@/lib/inbox/activity";

export type AuthState =
  | { error?: string; needsConfirmation?: boolean }
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
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
