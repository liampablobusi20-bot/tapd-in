import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase's confirmation, magic-link and reset-password emails link here. The email
// templates in the Supabase dashboard should point to
// `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next=...`,
// which works from any browser. A `code` link (the default template) is also accepted.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  // Only paths inside the app, never another site.
  const requested = searchParams.get("next") ?? "/dashboard";
  const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/dashboard";
  const isReset = type === "recovery" || next.startsWith("/reset-password");

  const supabase = await createClient();
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=${isReset ? "reset-failed" : "confirmation-failed"}`);
}
