import { NextResponse } from "next/server";

import {
  getPublicProfiles,
  getTopPublicProfiles,
  searchPublicProfiles,
  checkUsernameAvailability,
  isProfileFailure,
} from "@/server/features/profile";

/**
 * `GET /api/profiles/lookup` — batch and list reads (Phase 2C).
 *
 * One route for the three read shapes that are all "several public profiles", which
 * keeps the batch semantics in one place instead of three near-identical endpoints:
 *
 *   `?uids=a,b,c`   → the public projection for those uids (feeds, stats)
 *   `?top=5`        → the leaderboard
 *   `?q=ada`        → profile search
 *   `?available=x`  → is this handle free (the signup/settings check)
 *
 * Everything returned goes through the same `PublicProfile` projection, so no branch
 * can accidentally leak `role`.
 *
 * `?uids=` replaces the per-row loop in `notifications.ts` and `stats.ts`, which asked
 * Supabase for one profile at a time inside a `Promise.all`.
 */
export const dynamic = "force-dynamic";

const MAX_UIDS = 100;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const uidsParam = params.get("uids");
  if (uidsParam !== null) {
    const uids = uidsParam
      .split(",")
      .map((uid) => uid.trim())
      .filter((uid) => uid.length > 0)
      .slice(0, MAX_UIDS);

    const result = await getPublicProfiles(uids);
    if (isProfileFailure(result)) return failure(result.reason);
    return NextResponse.json({ profiles: result.data });
  }

  const available = params.get("available");
  if (available !== null) {
    const result = await checkUsernameAvailability(available);
    if (isProfileFailure(result)) return failure(result.reason);
    return NextResponse.json({ available: result.data });
  }

  const top = params.get("top");
  if (top !== null) {
    const parsed = Number.parseInt(top, 10);
    const result = await getTopPublicProfiles(Number.isFinite(parsed) ? parsed : 5);
    if (isProfileFailure(result)) return failure(result.reason);
    return NextResponse.json({ profiles: result.data });
  }

  const query = params.get("q");
  if (query !== null) {
    const result = await searchPublicProfiles(query);
    if (isProfileFailure(result)) return failure(result.reason);
    return NextResponse.json({ profiles: result.data });
  }

  return NextResponse.json({ error: "missing_query" }, { status: 400 });
}

function failure(reason: string) {
  if (reason === "database_not_configured") {
    return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
  }
  return NextResponse.json({ error: "profile_unavailable" }, { status: 500 });
}
