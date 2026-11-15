import { NextResponse, type NextRequest } from "next/server";
import { trustedMutation } from "@/server/auth/config";
import { getSessionCookie } from "better-auth/cookies";
import { isProtectedPath } from "@/lib/route-access";
import { loginPath } from "@/lib/return-path";
/** Optimistic navigation only. Every feature/API validates the DB session.
 * Never intercept auth callbacks or perform Supabase token rotation. */
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    if (!request.nextUrl.pathname.startsWith("/api/auth/") && !["GET","HEAD","OPTIONS"].includes(request.method) && !trustedMutation(request)) return NextResponse.json({error:"untrusted_origin"},{status:403});
    return NextResponse.next();
  }
  if (isProtectedPath(request.nextUrl.pathname) && !getSessionCookie(request, { cookiePrefix: "borynx" })) {
    return NextResponse.redirect(new URL(loginPath(request.nextUrl.pathname + request.nextUrl.search), request.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2)$).*)"] };
