import { NextResponse } from "next/server";

import {
  deletePostForCurrentUser,
  getPost,
  isContentFailure,
  recordPostView,
  updatePostForCurrentUser,
} from "@/server/features/content";
import { failure, readJsonBody, writeResponse } from "@/server/features/content/http";

/**
 * One post.
 *
 * A post the caller may not see returns `404`, identical to a post that does not
 * exist — the client shows the same "not found" state for both, and distinguishing
 * them would confirm the existence of hidden content.
 */
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const result = await getPost(id);

  if (isContentFailure(result)) return failure(result.reason);
  if (!result.data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ post: result.data });
}

/** Edits the body. Author only — enforced in the `where` clause, not by the route. */
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  const body = await readJsonBody(request);

  const result = await updatePostForCurrentUser(id, String(body.body ?? ""));
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data);
}

/** Soft delete. Author only. */
export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;

  const result = await deletePostForCurrentUser(id);
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data);
}

/**
 * `POST /api/content/posts/[id]` — record a view.
 *
 * A separate verb rather than a side effect of `GET`, so a read stays idempotent and
 * cacheable and the counter write is explicit.
 */
export async function POST(_request: Request, context: Context) {
  const { id } = await context.params;
  await recordPostView(id);
  return NextResponse.json({ ok: true });
}
