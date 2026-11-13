import { NextResponse } from "next/server";

import { getModerationProfiles, isProfileFailure } from "@/server/features/profile";

/**
 * `GET /api/profiles/moderation` — profile rows including `role`.
 *
 * The only profile endpoint that returns other users' roles, because the moderation
 * queue needs them. Authorization is **not** in this file: `getModerationProfiles`
 * reads the caller's own role from Neon and refuses unless it is `admin` or
 * `moderator`. Keeping the check next to the query means a second caller cannot forget
 * it, and there is no version of this route that returns roles to a non-admin by
 * configuration.
 *
 * `403` deliberately does not distinguish "not signed in" from "not staff": the
 * distinction would let an anonymous visitor probe whether an account exists. `401`
 * is still returned for the genuinely unauthenticated case because the client needs to
 * know whether to redirect to login.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limitParam = new URL(request.url).searchParams.get("limit");
  const parsed = Number.parseInt(limitParam ?? "50", 10);
  const limit = Number.isFinite(parsed) ? parsed : 50;

  const result = await getModerationProfiles(limit);

  if (isProfileFailure(result)) {
    switch (result.reason) {
      case "unauthenticated":
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      case "database_not_configured":
        return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
      case "invalid_identity":
        // Either no profile row, or a role that is not staff.
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      default:
        return NextResponse.json({ error: "profile_unavailable" }, { status: 500 });
    }
  }

  return NextResponse.json({ users: result.data });
}
