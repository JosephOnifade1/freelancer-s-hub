import { NextResponse } from "next/server";

import { getPublicProfile, isProfileFailure } from "@/server/features/profile";

/**
 * `GET /api/profiles/[identifier]` — a public profile by username or uid.
 *
 * Phase 2C replaces `getUserProfile(identifier)` in `src/lib/users.ts`, which read
 * Supabase. This route is **anonymous-friendly** because a profile is a public page;
 * `AuthGate` already gates the pages that need a session.
 *
 * What changed in the contract, and why:
 *
 *  - `404` means "no such profile". The old helper returned `null`, which callers
 *    could not distinguish from "the request failed" — `Profile.tsx` showed
 *    "not found" for both.
 *  - The payload is the `PublicProfile` projection, which **excludes `role`**. The
 *    Supabase version selected `*`, so every profile read shipped the account's
 *    admin/moderator flag to the browser. That was not exploitable on its own (RLS
 *    guarded the writes) but it let any visitor enumerate staff accounts, and it is
 *    the kind of thing that becomes exploitable the moment an endpoint trusts it.
 *  - No `ensureUserProfile` fallback. A read no longer creates a row; creation is
 *    provisioning's job and it is idempotent.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ identifier: string }> },
) {
  const { identifier } = await context.params;
  const decoded = decodeURIComponent(identifier ?? "").trim();

  if (!decoded) {
    return NextResponse.json({ error: "invalid_identifier" }, { status: 400 });
  }

  const result = await getPublicProfile(decoded);

  if (isProfileFailure(result)) {
    switch (result.reason) {
      case "database_not_configured":
        return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
      default:
        return NextResponse.json({ error: "profile_unavailable" }, { status: 500 });
    }
  }

  if (!result.data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ profile: result.data });
}
