import { NextResponse } from "next/server";

import { setCurrentReputation, isMutationFailure } from "@/server/features/profile";

/**
 * `POST /api/profile/reputation` — persist the caller's reputation total (Phase 2C).
 *
 * **The total is still computed client-side, from Supabase.** That looks backwards
 * and it is deliberate: reputation is `sum(posts.score) + sum(comments.score)`, and
 * both tables still live in Supabase. Computing it here would mean this route reaches
 * into a second database — exactly the dual-read the brief forbids — while computing it
 * on the server from Neon would sum two empty tables and zero every user's score.
 *
 * So this phase migrates the *write target*, not the *derivation*: the number is
 * produced where the data lives and written where the profile lives. The scope is safe
 * because the write is bound to the session uid — a client cannot set anyone else's
 * reputation, and `setReputation` rejects negatives.
 *
 * When posts, comments and votes move to Neon, `calculateReputation` must move with
 * them and this route must stop accepting a number from the caller. That is recorded
 * as a follow-up rather than silently left as a trust boundary.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const total = (body as { total?: unknown } | null)?.total;
  if (typeof total !== "number") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await setCurrentReputation(total);

  if (isMutationFailure(result)) {
    switch (result.reason) {
      case "unauthenticated":
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      case "database_not_configured":
        return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
      case "invalid_identity":
        return NextResponse.json({ error: "invalid_identity" }, { status: 400 });
      default:
        return NextResponse.json({ error: "reputation_update_failed" }, { status: 500 });
    }
  }

  if (result.outcome.status === "invalid") {
    return NextResponse.json({ error: "invalid_total" }, { status: 400 });
  }
  if (result.outcome.status === "profile_missing") {
    return NextResponse.json({ error: "profile_not_provisioned" }, { status: 404 });
  }
  if (result.outcome.status === "failed") {
    return NextResponse.json({ error: "reputation_update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
