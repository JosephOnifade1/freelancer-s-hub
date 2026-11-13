import { NextResponse } from "next/server";

import { adjustCurrentFollowing, isMutationFailure } from "@/server/features/profile";

/**
 * `POST /api/profile/following-counter` — adjust the caller's own `following` total.
 *
 * Replaces the `increment_following` / `decrement_following` RPCs, which took a
 * `target_uid` argument. That was safe only because RLS guarded the call; against Neon
 * there is no RLS, so the uid is now the session's and the parameter is gone. "Adjust
 * somebody else's counter" is not an expressible request.
 *
 * **Only the caller's own half moves.** Following somebody increments *their*
 * `followers`, and both `follows` and the target's profile row belong to domains this
 * phase does not migrate. So `followers` continues to be written by the existing RPC
 * until `follows` moves, and only `following` is written here. The transition is
 * visible in `toggleFollow` and is documented in the phase report rather than hidden
 * behind a helper that appears to do both.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const delta = (body as { delta?: unknown } | null)?.delta;
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: "invalid_delta" }, { status: 400 });
  }

  const result = await adjustCurrentFollowing(delta);

  if (isMutationFailure(result)) {
    switch (result.reason) {
      case "unauthenticated":
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      case "database_not_configured":
        return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
      case "invalid_identity":
        return NextResponse.json({ error: "invalid_identity" }, { status: 400 });
      default:
        return NextResponse.json({ error: "counter_update_failed" }, { status: 500 });
    }
  }

  if (result.outcome.status === "invalid") {
    return NextResponse.json({ error: "invalid_delta" }, { status: 400 });
  }
  if (result.outcome.status === "failed") {
    return NextResponse.json({ error: "counter_update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
