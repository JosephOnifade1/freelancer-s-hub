import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sanitizeReturnPath, DEFAULT_RETURN_PATH } from "@/lib/return-path";

/**
 * OAuth / PKCE callback (Phase 1.1, Step 4).
 *
 * Supabase redirects here with `?code=…&next=<destination>` after the provider
 * round trip. This is a Route Handler, so it *can* write cookies — unlike a
 * Server Component — which makes it the correct place to exchange the code and
 * establish the cookie session the rest of the app then reads.
 *
 * The destination is passed through `sanitizeReturnPath`, the same validator the
 * `/login?from=` contract uses. There is deliberately no second validation path:
 * a hostile `next` falls back to `/` exactly as a hostile `from` does.
 *
 * Failure modes, all no-loop:
 *  - missing `code`               → back to /login (the session was never created)
 *  - exchange error               → /login with the error surfaced in the query
 *  - anything thrown              → /login
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;

  const code = searchParams.get("code");
  const next = sanitizeReturnPath(searchParams.get("next") ?? searchParams.get("from"), DEFAULT_RETURN_PATH);

  // No code means the provider refused or the user cancelled. Bounce to /login
  // without touching cookies — there is no session to establish.
  if (!code) {
    return NextResponse.redirect(new URL(loginRedirectUrl(next, "missing_code"), origin));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    // Supabase is not configured (or demo mode): there is nothing to exchange.
    return NextResponse.redirect(new URL(loginRedirectUrl(next, "unconfigured"), origin));
  }

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(loginRedirectUrl(next, "exchange_failed"), origin));
    }
  } catch {
    return NextResponse.redirect(new URL(loginRedirectUrl(next, "exchange_failed"), origin));
  }

  // Same-origin redirect to the validated destination. `new URL(next, origin)`
  // cannot leave the origin because `next` is a `/`-prefixed path by now.
  return NextResponse.redirect(new URL(next, origin));
}

/** `/login?from=…&auth_error=…` — keeps the destination *and* reports the failure. */
function loginRedirectUrl(next: string, reason: string): string {
  const params = new URLSearchParams({ auth_error: reason });
  const target = next !== DEFAULT_RETURN_PATH ? next : "";
  if (target) params.set("from", target);
  return `/login?${params.toString()}`;
}
