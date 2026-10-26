import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { requireInboxOwner } from "@/lib/inbox/require-owner";
import { CALENDAR_SCOPES, authorizeUrl } from "@/lib/inbox/microsoft";
import { microsoftCreds } from "@/lib/inbox/microsoft-sync";
import { encryptionKeyFromEnv, signState } from "@/lib/crypto";

// Sends a signed-in owner to Microsoft to approve read-only access to their mail.
export async function GET(request: Request) {
  const { user } = await requireInboxOwner();
  const creds = microsoftCreds();
  try {
    encryptionKeyFromEnv();
  } catch {
    redirect("/dashboard/settings?connect_error=not-configured");
  }
  if (!creds) redirect("/dashboard/settings?connect_error=not-configured");

  const origin = new URL(request.url).origin;
  const state = signState(user.id);
  // Meeting briefs are optional and ask for one extra permission, only when chosen.
  const calendar = new URL(request.url).searchParams.get("feature") === "calendar";
  const response = NextResponse.redirect(
    authorizeUrl({
      clientId: creds.clientId,
      redirectUri: `${origin}/api/connect/microsoft/callback`,
      state,
      ...(calendar ? { scope: CALENDAR_SCOPES } : {}),
    })
  );
  if (calendar) {
    response.cookies.set("ms_oauth_feature", "calendar", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/api/connect/microsoft",
    });
  }
  // The same value must come back in the URL, which proves the round trip began here.
  response.cookies.set("ms_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/connect/microsoft",
  });
  return response;
}
