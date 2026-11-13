import { NextResponse } from "next/server";

import { getPosts, createPostForCurrentUser, isContentFailure } from "@/server/features/content";
import { failure, positiveInt, readJsonBody, writeResponse } from "@/server/features/content/http";

/**
 * `GET /api/content/posts` — an authorized feed page.
 *
 * Query parameters: `limit`, `before` (ISO timestamp, keyset pagination),
 * `community`, `author`, `type`, `tag`, `q` (title/body substring).
 *
 * Every row returned has passed `authorizationFilter` *inside the query*, so there is
 * no post-filter step whose absence would leak content. Anonymous callers are a
 * valid case (public posts only), not an error.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const result = await getPosts({
    limit: positiveInt(params.get("limit"), 100),
    before: params.get("before"),
    communitySlug: params.get("community"),
    authorUid: params.get("author"),
    type: params.get("type"),
    tag: params.get("tag"),
    search: params.get("q"),
  });

  if (isContentFailure(result)) return failure(result.reason);
  return NextResponse.json({ posts: result.data });
}

/**
 * `POST /api/content/posts` — create a post as the caller.
 *
 * The body carries no author: the server uses the verified session, so the client
 * cannot post as anyone else.
 */
export async function POST(request: Request) {
  const body = await readJsonBody(request);

  const result = await createPostForCurrentUser({
    title: String(body.title ?? ""),
    body: String(body.body ?? ""),
    category: (body.category as string | null) ?? null,
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
    type: typeof body.type === "string" ? body.type : undefined,
    communitySlug: (body.communitySlug as string | null) ?? null,
    visibility: typeof body.visibility === "string" ? body.visibility : undefined,
    allowComments: typeof body.allowComments === "boolean" ? body.allowComments : undefined,
    externalLink: (body.externalLink as string | null) ?? null,
    pollOptions: Array.isArray(body.pollOptions) ? (body.pollOptions as string[]) : [],
  });

  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data, 200);
}
