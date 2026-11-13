import { NextResponse } from "next/server";

import { setCurrentAvatar, isMutationFailure } from "@/server/features/profile";

/**
 * `POST /api/profile/avatar` — record the caller's avatar reference (Phase 2C).
 *
 * **Storage is untouched.** The file is still uploaded by the browser to Supabase
 * Storage (`avatars/<uid>/…`, own-folder write policy) exactly as before; this route
 * only stores the resulting URL in Neon. That separation is the ownership rule from
 * Phase 2B.4 §5: Storage owns the object, Neon owns the pointer.
 *
 * The URL is validated as http(s) server-side rather than trusted. `avatarUrl` is
 * rendered straight into an `<img src>`, so a `javascript:` or `data:` value from a
 * compromised client would be a stored XSS vector on every page that shows the
 * avatar.
 *
 * No uid in the body: the row updated is the session's own.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const url = (body as { url?: unknown } | null)?.url;
  if (typeof url !== "string" || url.trim().length === 0) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await setCurrentAvatar(url.trim());

  if (isMutationFailure(result)) {
    switch (result.reason) {
      case "unauthenticated":
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      case "database_not_configured":
        return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
      case "invalid_identity":
        return NextResponse.json({ error: "invalid_identity" }, { status: 400 });
      default:
        return NextResponse.json({ error: "avatar_update_failed" }, { status: 500 });
    }
  }

  switch (result.outcome.status) {
    case "updated":
      return NextResponse.json({ profile: result.outcome.profile });
    case "profile_missing":
      return NextResponse.json({ error: "profile_not_provisioned" }, { status: 404 });
    case "invalid":
      // Reached when the URL is not http(s): rejected, not silently stored.
      return NextResponse.json({ error: "invalid_avatar_url" }, { status: 400 });
    default:
      return NextResponse.json({ error: "avatar_update_failed" }, { status: 500 });
  }
}
