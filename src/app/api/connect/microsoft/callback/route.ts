import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireInboxOwner } from "@/lib/inbox/require-owner";
import { encryptSecret, verifyState } from "@/lib/crypto";
import { CALENDAR_SCOPES, SCOPES, exchangeCode, fetchAccountEmail } from "@/lib/inbox/microsoft";
import { microsoftCreds } from "@/lib/inbox/microsoft-sync";

const BACKFILL_MS = 3 * 86_400_000;

function back(request: Request, query: string) {
  const response = NextResponse.redirect(new URL(`/dashboard/settings?${query}`, request.url));
  response.cookies.delete({ name: "ms_oauth_state", path: "/api/connect/microsoft" });
  response.cookies.delete({ name: "ms_oauth_feature", path: "/api/connect/microsoft" });
  return response;
}

// Microsoft sends the person back here with a one-time code, which is traded for
// tokens. The state is checked against both the cookie and the signed-in account.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  // A company's IT administrator lands here after approving Tapd In for their
  // whole organization. They don't have a Tapd In account, so this page needs none.
  if (params.has("admin_consent")) {
    const approved = params.get("admin_consent")?.toLowerCase() === "true";
    const message = approved
      ? "Thanks. Tapd In is approved for your organization. People there can now connect their mailbox, and you can close this tab."
      : "Tapd In wasn't approved. Nothing was changed, and you can close this tab.";
    return new Response(
      `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tapd In</title>` +
        `<body style="font-family:system-ui,sans-serif;background:#faf8f4;color:#1b1a17;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">` +
        `<p style="max-width:28rem;padding:2rem;line-height:1.6">${message}</p></body></html>`,
      { headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  const { user } = await requireInboxOwner();

  const denied = params.get("error");
  if (denied) {
    const detail = (params.get("error_description") ?? "").toLowerCase();
    const needsAdmin = /admin|aadsts65001|aadsts90094|aadsts650056|consent/.test(detail);
    return back(request, `connect_error=${needsAdmin ? "needs-admin" : "declined"}`);
  }

  const state = params.get("state") ?? "";
  const code = params.get("code");
  const jar = await cookies();
  const saved = jar.get("ms_oauth_state")?.value;
  const calendar = jar.get("ms_oauth_feature")?.value === "calendar";
  if (!code || !state || state !== saved || verifyState(state) !== user.id) {
    return back(request, "connect_error=failed");
  }

  const creds = microsoftCreds();
  if (!creds) return back(request, "connect_error=not-configured");

  try {
    const tokens = await exchangeCode(code, `${new URL(request.url).origin}/api/connect/microsoft/callback`, creds, fetch, Date.now(), calendar ? CALENDAR_SCOPES : SCOPES);
    const email = await fetchAccountEmail(tokens.accessToken);
    if (!email) return back(request, "connect_error=failed");

    const supabase = createAdminClient();
    const encrypted = encryptSecret(tokens.refreshToken);
    const { data: existing } = await supabase
      .from("inbox_connections")
      .select("id")
      .eq("owner_id", user.id)
      .eq("provider", "microsoft")
      .eq("account_email", email)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("inbox_connections")
        .update({ refresh_token_enc: encrypted, status: "active", calendar_enabled: calendar })
        .eq("id", existing.id);
    } else {
      // Start a few days back so the first briefing has something in it.
      await supabase.from("inbox_connections").insert({
        owner_id: user.id,
        provider: "microsoft",
        account_email: email,
        refresh_token_enc: encrypted,
        synced_through: new Date(Date.now() - BACKFILL_MS).toISOString(),
        calendar_enabled: calendar,
      });
    }
    return back(request, calendar ? "connected=calendar" : "connected=microsoft");
  } catch {
    return back(request, "connect_error=failed");
  }
}
