import { NextResponse } from "next/server";

import {
  createCommentForCurrentUser,
  getComments,
  isContentFailure,
} from "@/server/features/content";
import { failure, readJsonBody, writeResponse } from "@/server/features/content/http";

/**
 * `GET  /api/content/posts/[id]/comments` — the post's comments.
 * `POST /api/content/posts/[id]/comments` — add one (or reply with `parentId`).
 *
 * A comment on a post the caller cannot see is refused as `404`: the original policy
 * required `can_view_post("postId")` for the insert, so a hidden post could not be
 * commented on even by someone who guessed its id.
 */
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;

  const result = await getComments(id);
  if (result.ok === false) return failure(result.reason);
  return NextResponse.json({ comments: result.data });
}

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const body = await readJsonBody(request);

  const result = await createCommentForCurrentUser(id, {
    body: String(body.body ?? ""),
    parentId: (body.parentId as string | null) ?? null,
  });

  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data, 200);
}
