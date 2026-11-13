import { NextResponse } from "next/server";

import {
  createCommentForCurrentUser,
  deleteCommentForCurrentUser,
  isContentFailure,
  updateCommentForCurrentUser,
} from "@/server/features/content";
import { failure, readJsonBody, writeResponse } from "@/server/features/content/http";

/**
 * Comment operations scoped to one comment id.
 *
 * `POST /api/content/posts/[id]/comments` creates; these act on an existing comment.
 * Author checks live in the `where` clause, so a non-author's edit matches zero rows
 * and is reported as `404` — the same answer as a comment that does not exist.
 */
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  const body = await readJsonBody(request);

  const result = await updateCommentForCurrentUser(id, String(body.body ?? ""));
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data);
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;

  const result = await deleteCommentForCurrentUser(id);
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data);
}

/**
 * Replies are created through the post route below, but a `POST` here is accepted and
 * routed through the same service so a client that has only the comment id can reply
 * without a second lookup. `postId` must be supplied because it is the parent's.
 */
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  const body = await readJsonBody(request);
  const postId = String(body.postId ?? "");

  if (!postId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const result = await createCommentForCurrentUser(postId, {
    body: String(body.body ?? ""),
    parentId: id,
  });
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data);
}
