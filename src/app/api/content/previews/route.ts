import { NextResponse } from "next/server";

import { getContentPreviews, isContentFailure } from "@/server/features/content";
import { failure } from "@/server/features/content/http";

/**
 * `POST /api/content/previews` — post and comment bodies for the moderation queue.
 *
 * Staff only, enforced in `getContentPreviews` (not here), so a second caller cannot
 * forget the check. A batch endpoint because the report queue needs previews for up to
 * a page of reports at once; doing it per report would be N+1.
 *
 * Body: `{ postIds: string[], commentIds: string[] }`.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const postIds = Array.isArray(body.postIds) ? (body.postIds as string[]) : [];
  const commentIds = Array.isArray(body.commentIds) ? (body.commentIds as string[]) : [];

  const result = await getContentPreviews(postIds, commentIds);
  if (isContentFailure(result)) return failure(result.reason);
  return NextResponse.json(result.data);
}
