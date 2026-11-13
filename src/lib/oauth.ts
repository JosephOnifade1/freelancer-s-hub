import { sanitizeReturnPath } from "./return-path";

/**
 * Builds the OAuth `redirectTo` for this origin (Phase 1.1).
 *
 * Phase 1 sent the provider straight back to the destination page, so the
 * `?code=` was handled by a client that had not yet exchanged it — the session
 * only existed in whichever storage the browser client used. Now every OAuth
 * round trip lands on `/auth/callback`, a Route Handler that exchanges the code
 * server-side and establishes the cookie session before forwarding the user on.
 *
 * The destination travels as `?next=<path>` and is validated on the way in
 * (`sanitizeReturnPath` at the call site below) *and* again in the callback, so
 * neither leg can be tricked into an open redirect.
 */
export function oauthCallbackUrl(origin: string, destination: string | null | undefined): string {
  const safe = sanitizeReturnPath(destination, "/");
  const url = new URL("/auth/callback", origin);
  if (safe !== "/") url.searchParams.set("next", safe);
  return url.toString();
}
