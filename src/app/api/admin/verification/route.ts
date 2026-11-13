import { NextResponse } from "next/server";

import { isContentFailure, setUserVerifiedProByCurrentUser } from "@/server/features/content";
import { failure, readJsonBody, writeResponse } from "@/server/features/content/http";

/**
 * `POST /api/admin/verification` — set Verified Pro (Phase 2D §7).
 *
 * Replaces the Supabase RPC `set_user_verified_pro`. Same authorization as the role
 * route: an admin, acting on someone else. Verification was never self-service —
 * `set_user_verified_pro` checked `is_admin(auth.uid())` — and it still is not, so a
 * user cannot verify themselves by calling this.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonBody(request);

  const targetUid = String(body.uid ?? "");
  if (!targetUid) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (typeof body.verified !== "boolean") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const result = await setUserVerifiedProByCurrentUser(targetUid, body.verified);
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data as { status: string });
}
