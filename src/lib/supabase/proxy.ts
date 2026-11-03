import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwnerRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isResetRoute = request.nextUrl.pathname.startsWith("/reset-password");

  // An expired or reused reset link leaves no session, so there is nothing to reset.
  if (isResetRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?error=reset-failed";
    return NextResponse.redirect(url);
  }

  if (isOwnerRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // An account with two-step sign-in on must finish it before reaching anything private.
  const needsSecondStep = isOwnerRoute || isResetRoute || request.nextUrl.pathname.startsWith("/admin");
  if (user && needsSecondStep) {
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level?.nextLevel === "aal2" && level.currentLevel !== "aal2") {
      const url = request.nextUrl.clone();
      url.pathname = "/login/verify";
      // After the code, a reset carries on to choosing the new password.
      url.search = isResetRoute ? "?next=/reset-password" : "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
