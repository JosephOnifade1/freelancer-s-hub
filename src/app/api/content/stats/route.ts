import { NextResponse } from "next/server";

import {
  getCommunityHealth,
  getRecentContributors,
  getAuthorResourceCount,
  getAuthorScores,
  getContributionDates,
  isContentFailure,
} from "@/server/features/content";
import { failure } from "@/server/features/content/http";

/**
 * `GET /api/content/stats` — aggregate content statistics.
 *
 * Query parameters:
 *   `activity=1&days=7`  → contributors ranked by recent contributions
 *   `streak=<uid>&days=90` → distinct active dates for one author
 *   `health=1`           → community health aggregates
 *   `scores=<uid>`       → summed post+comment score for one author
 *
 * These are **counts and timestamps only**. No post or comment body is returned, so
 * the aggregates cannot leak content the caller is not authorized to read: a count of
 * "posts this week" is true for every viewer and reveals nothing about a specific
 * post, while listing the posts would.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  if (params.get("activity")) {
    const days = Number.parseInt(params.get("days") ?? "7", 10) || 7;
    const result = await getRecentContributors(days);
    if (isContentFailure(result)) return failure(result.reason);
    return NextResponse.json({ contributors: result.data });
  }

  if (params.get("streak")) {
    const days = Number.parseInt(params.get("days") ?? "90", 10) || 90;
    const result = await getContributionDates(params.get("streak")!, days);
    if (isContentFailure(result)) return failure(result.reason);
    return NextResponse.json({ dates: result.data });
  }

  if (params.get("health")) {
    const result = await getCommunityHealth();
    if (isContentFailure(result)) return failure(result.reason);
    return NextResponse.json({ health: result.data });
  }

  if (params.get("resources")) {
    const result = await getAuthorResourceCount(params.get("resources")!);
    if (isContentFailure(result)) return failure(result.reason);
    return NextResponse.json({ count: result.data });
  }

  if (params.get("scores")) {
    const result = await getAuthorScores(params.get("scores")!);
    if (isContentFailure(result)) return failure(result.reason);
    return NextResponse.json({ total: result.data });
  }

  return NextResponse.json({ error: "invalid" }, { status: 400 });
}
