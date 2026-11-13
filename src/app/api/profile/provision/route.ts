import { NextResponse } from "next/server";

import { ensureProfileForCurrentUser, isIdentityFailure } from "@/server/features/identity";

/**
 * `POST /api/profile/provision` (Phase 2B.3).
 *
 * Creates the Neon profile for the authenticated Supabase user if it does not
 * exist. Idempotent: calling it twice is safe and returns `created: false`.
 *
 * **No request body is read.** The identity comes from the verified Supabase
 * session cookie, so there is nothing a client could supply to provision a
 * profile for somebody else. That is the authorization decision for this route:
 * `POST` is authenticated-only by construction, not by a caller-supplied id.
 *
 * Status codes map to the identity layer's reasons, so a client can distinguish
 * "log in" from "the database is not configured" — the distinction the audit
 * insisted on, because conflating them produces login loops.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await ensureProfileForCurrentUser();

  if (isIdentityFailure(result)) {
    switch (result.reason) {
      case "unauthenticated":
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      case "database_not_configured":
        return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
      case "invalid_identity":
        return NextResponse.json({ error: "invalid_identity" }, { status: 400 });
      default:
        // Deliberately opaque: the driver's message can contain the connection
        // string, and a provisioning failure is not the client's problem to
        // diagnose.
        return NextResponse.json({ error: "profile_provisioning_failed" }, { status: 500 });
    }
  }

  return NextResponse.json(
    {
      profile: result.profile,
      // A successful Supabase login is *not* the same as a provisioned profile;
      // this flag is the only signal a client may use to claim otherwise.
      provisioned: true,
    },
    { status: result.profile.created ? 201 : 200 },
  );
}
