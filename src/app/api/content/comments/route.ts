import { NextResponse } from "next/server";

import { getComments, getCommentsByAuthor } from "@/server/features/content";
import { failure, positiveInt } from "@/server/features/content/http";

/**
 * `GET /api/content/comments?postId=…` — comments on a visible post.
 *
 * `GET /api/content/comments?author=…` — comments written by one author.
 *
 * Comments have no visibility of their own: the check is on their post, which is what
 * `can_view_post("postId")` did for the `comments` policy. A post the caller cannot
 * see yields an empty list rather than an error, matching RLS, where the rows were
 * simply not returned.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const postId = params.get("postId");
  const authorUid = params.get("author");

  if (postId) {
    const result = await getComments(postId);
    if (result.ok === false) return failure(result.reason);
    return NextResponse.json({ comments: result.data });
  }

  if (authorUid) {
    const result = await getCommentsByAuthor(authorUid);
    if (result.ok === false) return failure(result.reason);
    return NextResponse.json({ comments: result.data });
  }

  // Without either selector the query has no meaning; refuse rather than return every
  // comment in the database.
  void positiveInt(params.get("limit"), 200);
  return NextResponse.json({ error: "invalid" }, { status: 400 });
}
