"use server";

import { revalidatePath } from "next/cache";
import { requireInboxOwner } from "@/lib/inbox/require-owner";
import { logActivity } from "@/lib/inbox/activity-log";

export type StartResult = { ok: true; factorId: string; qr: string; secret: string } | { ok: false; error: string };
export type StepResult = { ok: true } | { ok: false; error: string };

const BAD_CODE = "That code didn't work. Check the 6 digits in your app and try again.";
const SOMETHING_WRONG = "Something went wrong. Please try again.";
const isCode = (code: string) => /^\d{6}$/.test(code);

// Begins turning on two-step sign-in: makes the secret the person scans into an
// authenticator app. Nothing is switched on until they prove it works.
export async function startTwoStep(): Promise<StartResult> {
  const { supabase } = await requireInboxOwner();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp?.length) return { ok: false, error: "Two-step sign-in is already on." };

  // A setup that was started and abandoned would block a new one.
  for (const factor of factors?.all ?? []) {
    if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Tapd In", friendlyName: "Authenticator app" });
  if (error || !data?.totp) return { ok: false, error: SOMETHING_WRONG };
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function finishTwoStep(factorId: string, code: string): Promise<StepResult> {
  const { supabase, user } = await requireInboxOwner();
  const digits = code.replace(/\s+/g, "");
  if (!isCode(digits)) return { ok: false, error: BAD_CODE };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: digits });
  if (error) return { ok: false, error: BAD_CODE };

  await logActivity(user.id, "two_step_enabled");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

// Turning it off needs a fresh code, so someone at an unattended screen can't do it.
export async function disableTwoStep(code: string): Promise<StepResult> {
  const { supabase, user } = await requireInboxOwner();
  const digits = code.replace(/\s+/g, "");
  if (!isCode(digits)) return { ok: false, error: BAD_CODE };

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) return { ok: true };

  const verified = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: digits });
  if (verified.error) return { ok: false, error: BAD_CODE };
  const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
  if (error) return { ok: false, error: SOMETHING_WRONG };

  await logActivity(user.id, "two_step_disabled");
  revalidatePath("/dashboard/settings");
  return { ok: true };
}
