import { NextResponse } from "next/server";

import { getSavedPostIds, isContentFailure } from "@/server/features/content";
import { failure } from "@/server/features/content/http";

/**
 * `GET /api/content/saved` — the caller's own bookmarks.
 *
 * Takes no uid, on purpose: the previous `getSavedPostIds(uid)` accepted one and RLS
 * silently narrowed it, so the *shape* of the API implied a capability it did not
 * have. Bookmarks are private, so the subject is always the session.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getSavedPostIds();
  if (isContentFailure(result)) return failure(result.reason);
  return NextResponse.json({ postIds: result.data });
}
