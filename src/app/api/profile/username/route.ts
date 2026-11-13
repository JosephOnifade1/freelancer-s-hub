import { NextResponse } from "next/server";

import { claimUsernameForCurrentUser, isIdentityFailure } from "@/server/features/identity";

/**
 * `POST /api/profile/username` (Phase 2B.3).
 *
 * Atomically claims a handle for the **authenticated** user.
 *
 * The body carries exactly one field — the desired handle — and there is
 * deliberately no `uid` field: a client cannot claim a handle on behalf of
 * anybody else because there is no parameter through which to express it. Adding
 * one later would be a security change, not a convenience.
 *
 * Outcomes are typed at the service layer and mapped to status codes here:
 *
 *   200 `{ status: "claimed" | "same" }` – done (idempotent when already yours)
 *   400 `{ status: "invalid" }`           – fails USERNAME_RE
 *   409 `{ status: "taken" }`             – someone else owns it
 *   401 unauthenticated
 *   404 `{ status: "profile_missing" }`   – no Neon profile yet
 *   500 `{ status: "failed" }`            – unexpected; details withheld
 *   503 database not configured
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let desired: unknown;
  try {
    const body = (await request.json()) as { username?: unknown } | null;
    desired = body?.username;
  } catch {
    return NextResponse.json({ status: "invalid", reason: "malformed_body" }, { status: 400 });
  }

  const result = await claimUsernameForCurrentUser(typeof desired === "string" ? desired : "");

  if (isIdentityFailure(result)) {
    switch (result.reason) {
      case "unauthenticated":
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      case "database_not_configured":
        return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
      case "invalid_identity":
        return NextResponse.json({ status: "invalid", reason: "invalid_identity" }, { status: 400 });
      default:
        return NextResponse.json({ status: "failed" }, { status: 500 });
    }
  }

  const outcome = result.outcome;
  switch (outcome.status) {
    case "claimed":
      return NextResponse.json({ status: "claimed", username: outcome.username }, { status: 200 });
    case "same":
      return NextResponse.json({ status: "same", username: outcome.username }, { status: 200 });
    case "invalid":
      return NextResponse.json({ status: "invalid", reason: outcome.reason }, { status: 400 });
    case "taken":
      return NextResponse.json({ status: "taken" }, { status: 409 });
    case "profile_missing":
      return NextResponse.json({ status: "profile_missing" }, { status: 404 });
    default:
      return NextResponse.json({ status: "failed" }, { status: 500 });
  }
}
