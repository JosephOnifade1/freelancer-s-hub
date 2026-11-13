import { NextResponse } from "next/server";

import { castVoteForCurrentUser, getOwnVote, isContentFailure } from "@/server/features/content";
import { failure, readJsonBody, writeResponse } from "@/server/features/content/http";

/**
 * Votes.
 *
 * `GET  /api/content/votes?entityType=post&entityId=…` — the caller's own vote.
 * `POST /api/content/votes` — cast / switch / remove one.
 *
 * The body carries `entityType`, `entityId` and `voteValue` — **never a voter**. The
 * legacy `cast_vote` call accepted `voter_uid` and the client passed the session uid
 * from the browser; here the voter is resolved server-side, so a vote cannot be cast
 * on another user's behalf even by replaying a request with a modified body.
 *
 * `voteValue` is `1`, `-1` or `0`, where `0` removes the vote. That is the existing
 * product model — upvote/downvote with a removable choice — and it is preserved
 * rather than collapsed into likes.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const entityType = params.get("entityType") === "comment" ? "comment" : "post";
  const entityId = params.get("entityId");

  if (!entityId) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const result = await getOwnVote(entityType, entityId);
  if (isContentFailure(result)) return failure(result.reason);
  return NextResponse.json({ voteValue: result.data });
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);

  const entityType = body.entityType === "comment" ? "comment" : "post";
  const entityId = String(body.entityId ?? "");
  const voteValue = Number(body.voteValue);

  if (![1, -1, 0].includes(voteValue)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const result = await castVoteForCurrentUser(entityType, entityId, voteValue);
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data as { status: string });
}
