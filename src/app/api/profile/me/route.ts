import { NextResponse } from "next/server";

import {
  getCurrentProfile,
  updateCurrentProfile,
  isOwnProfileFailure,
  isMutationFailure,
  type EditableProfileFields,
} from "@/server/features/profile";

/**
 * `GET /api/profile/me` — the signed-in user's own profile (Phase 2C).
 *
 * Replaces `getUserProfile(user.uid)` from `Settings` and `AppLayout`, which read
 * Supabase. Identity comes from the verified cookie session; **there is no uid
 * parameter**, so this route cannot be pointed at another account.
 *
 * `404` means "no profile row yet" — the pre-provisioning state. It is deliberately
 * distinct from `401` (no session) and `503` (no database), because the client shows
 * a different thing for each: the provisioning notice, the login redirect, or an
 * unavailable banner.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getCurrentProfile();

  if (isOwnProfileFailure(result)) {
    switch (result.reason) {
      case "unauthenticated":
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      case "database_not_configured":
        return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
      case "invalid_identity":
        return NextResponse.json({ error: "profile_not_provisioned" }, { status: 404 });
      default:
        // Opaque on purpose: driver messages can contain the connection string.
        return NextResponse.json({ error: "profile_unavailable" }, { status: 500 });
    }
  }

  // Bookmarks are deliberately **not** attached here. `saved_posts` is a separate
  // domain that has not migrated, and joining it into this response would drag the
  // Supabase client into a Neon route and couple two migrations. `Profile.tsx` keeps
  // reading its bookmarks tab from the existing helper.
  return NextResponse.json({ profile: result.profile });
}

/** The fields a client may send. Anything else in the body is ignored. */
const EDITABLE_KEYS = [
  "displayName",
  "bio",
  "location",
  "website",
  "status",
  "skills",
  "avatarUrl",
] as const;

/**
 * `PATCH /api/profile/me` — update the caller's own profile.
 *
 * The body is **whitelisted**, not spread. `role`, `isVerifiedPro`, `reputation`,
 * `followers` and `following` cannot appear in a request that changes anything,
 * because they are never read from the body — the same structural guarantee as the
 * write layer, enforced one layer earlier so a bad request is a 200 with nothing
 * changed rather than a 500.
 */
export async function PATCH(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const source = body as Record<string, unknown>;
  const fields: EditableProfileFields = {};
  for (const key of EDITABLE_KEYS) {
    if (key in source) {
      // The value's type is validated by the query layer; here it is only copied
      // for the keys that are allowed to exist at all.
      (fields as Record<string, unknown>)[key] = source[key];
    }
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "no_editable_fields" }, { status: 400 });
  }

  const result = await updateCurrentProfile(fields);

  if (isMutationFailure(result)) {
    switch (result.reason) {
      case "unauthenticated":
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      case "database_not_configured":
        return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
      case "invalid_identity":
        return NextResponse.json({ error: "invalid_identity" }, { status: 400 });
      default:
        return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
    }
  }

  switch (result.outcome.status) {
    case "updated":
      return NextResponse.json({ profile: result.outcome.profile });
    case "profile_missing":
      return NextResponse.json({ error: "profile_not_provisioned" }, { status: 404 });
    case "invalid":
      return NextResponse.json({ error: "invalid_fields" }, { status: 400 });
    default:
      return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
  }
}
