import { NextResponse } from "next/server";

import { isContentFailure, setUserRoleByCurrentUser } from "@/server/features/content";
import { failure, readJsonBody, writeResponse } from "@/server/features/content/http";

/**
 * `POST /api/admin/roles` — change a user's global role (Phase 2D §7).
 *
 * Replaces the Supabase RPC `set_user_role`. The authorization that used to live in
 * the RPC now lives in `setUserRole` in the query layer, next to the update it guards:
 * the actor must be an `admin`, and an admin cannot demote themselves.
 *
 * The body names the **target** only. The actor is the verified session, so a request
 * cannot claim to be an administrator it is not — the previous RPC took `auth.uid()`
 * from the database session, and this keeps that property.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonBody(request);

  const targetUid = String(body.uid ?? "");
  const role = String(body.role ?? "");
  if (!targetUid || !role) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const result = await setUserRoleByCurrentUser(targetUid, role);
  if (isContentFailure(result)) return failure(result.reason);
  return writeResponse(result.data as { status: string });
}
