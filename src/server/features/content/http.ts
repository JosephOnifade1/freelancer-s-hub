/**
 * Shared HTTP mapping for the content routes (Phase 2D).
 *
 * Every content route returns the same failure vocabulary, so the mapping lives in
 * one place rather than being re-derived per handler. The distinction that matters:
 *
 *   - `not_found` and `forbidden` are **separate statuses here but never leak across
 *     each other**. A post the viewer may not see returns `404`, exactly like a post
 *     that does not exist, because the client already treats them identically and a
 *     `403` would confirm that a hidden post exists.
 *   - A mutation refused because the caller is not the author returns `403`, since
 *     the post's existence is already public to them.
 */
import { NextResponse } from "next/server";

import type { ContentFailureReason } from "./index";

export type WriteOutcome = {
  status: string;
  [key: string]: unknown;
};

/** Maps a service-level failure to a status code. */
export function failureStatus(reason: ContentFailureReason): number {
  switch (reason) {
    case "unauthenticated":
      return 401;
    case "database_not_configured":
    case "not_ready":
      return 503;
    case "not_found":
      return 404;
    case "forbidden":
      return 403;
    case "invalid":
      return 400;
    default:
      return 500;
  }
}

export function failure(reason: ContentFailureReason) {
  return NextResponse.json({ error: reason }, { status: failureStatus(reason) });
}

/**
 * Maps a query-layer write outcome to a response.
 *
 * `not_found` covers both "no such row" and "not yours": the query layer
 * deliberately cannot tell them apart for author-scoped updates, because the update
 * itself is `where id = $1 and "authorUid" = $2`.
 */
export function writeResponse(outcome: WriteOutcome, successStatus = 200) {
  switch (outcome.status) {
    case "created":
      return NextResponse.json(outcome, { status: 201 });
    case "updated":
    case "removed":
    case "applied":
    case "voted":
    case "saved":
    case "unchanged":
      return NextResponse.json(outcome, { status: successStatus });

    case "not_found":
    case "profile_missing":
      return NextResponse.json({ error: "not_found" }, { status: 404 });

    case "forbidden":
      return NextResponse.json({ error: "forbidden" }, { status: 403 });

    case "self_vote":
      return NextResponse.json(
        { error: "self_vote", message: "You cannot vote on your own content" },
        { status: 403 },
      );

    case "self_demotion":
      return NextResponse.json(
        { error: "self_demotion", message: "Admins cannot demote themselves" },
        { status: 409 },
      );

    case "deleted_content":
      return NextResponse.json(
        { error: "deleted_content", message: "Cannot vote on deleted content" },
        { status: 409 },
      );

    case "comments_closed":
      return NextResponse.json(
        { error: "comments_closed", message: "Comments are turned off for this post." },
        { status: 409 },
      );

    case "post_removed":
      return NextResponse.json(
        { error: "post_removed", message: "This post has been removed." },
        { status: 409 },
      );

    case "already_voted":
      return NextResponse.json(
        { error: "already_voted", message: "You've already voted on this poll" },
        { status: 409 },
      );

    case "limit_reached":
      return NextResponse.json(
        { error: "limit_reached", message: "A post can have at most 3 documents." },
        { status: 409 },
      );

    case "invalid":
      return NextResponse.json({ error: "invalid" }, { status: 400 });

    default:
      return NextResponse.json({ error: "error" }, { status: 500 });
  }
}

/** Reads a JSON body without throwing on malformed input. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * A bounded integer from a query parameter.
 *
 * Returns `undefined` for anything non-numeric so the query layer applies its own
 * default rather than receiving `NaN`.
 */
export function positiveInt(value: string | null, max: number): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(parsed, max);
}
