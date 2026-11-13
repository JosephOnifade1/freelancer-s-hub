import { NextResponse } from "next/server";

import { isContentFailure, votePollForCurrentUser } from "@/server/features/content";
import { failure, readJsonBody, writeResponse } from "@/server/features/content/http";

/**
 * `POST /api/content/polls/vote` — cast a poll vote.
 *
 * Body: `{ pollId, pollOptionId }`. The voter is the session uid; there is no `userId`
 * field to forge. The unique `(pollId, userId)` key is the duplicate rule, and the
 * insert is `on conflict do nothing` so a replayed request reports `already_voted`
 * rather than a constraint error.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonBody(request);

  const pollId = String(body.pollId ?? "");
  const pollOptionId = String(body.pollOptionId ?? "");
  if (!pollId || !pollOptionId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const result = await votePollForCurrentUser(pollId, pollOptionId);
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data as { status: string });
}
