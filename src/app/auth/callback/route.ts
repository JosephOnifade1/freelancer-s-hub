import { NextResponse, type NextRequest } from "next/server";
/** Old Supabase PKCE links cannot create Better Auth sessions. Google now uses
 * /api/auth/callback/google. Fail closed, without consuming old provider codes. */
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login?auth_error=legacy_callback_expired", request.url));
}
