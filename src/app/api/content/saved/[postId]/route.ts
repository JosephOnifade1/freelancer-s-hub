import { NextResponse } from "next/server";

import { isContentFailure, toggleSavedPostForCurrentUser } from "@/server/features/content";
import { failure, writeResponse } from "@/server/features/content/http";

/**
 * `POST /api/content/saved/[postId]` — toggle a bookmark.
 *
 * The composite key `(userId, postId)` arbitrates: pressing twice returns `removed`,
 * and a concurrent double-press cannot produce a duplicate. The post must be visible
 * to the caller, so a bookmark cannot confirm the existence of hidden content.
 */
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  const { postId } = await context.params;

  const result = await toggleSavedPostForCurrentUser(postId);
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data as { status: string });
}
