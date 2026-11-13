import { NextResponse } from "next/server";

import { getPoll, isContentFailure } from "@/server/features/content";
import { failure } from "@/server/features/content/http";

/**
 * `GET /api/content/polls?postId=…` — the post's poll, its option counts and the
 * caller's own choice.
 *
 * Polls inherit their post's visibility, so this returns `404` for a poll whose post
 * the caller may not see — the same rule the `Read polls per post visibility` policy
 * applied.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const postId = new URL(request.url).searchParams.get("postId");
  if (!postId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const result = await getPoll(postId);
  if (isContentFailure(result)) return failure(result.reason);
  if (!result.data) return NextResponse.json({ poll: null });
  return NextResponse.json({ poll: result.data });
}
