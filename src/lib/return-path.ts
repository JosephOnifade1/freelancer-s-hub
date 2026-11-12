/**
 * Post-authentication return paths (`/login?from=…`).
 *
 * Phase 1 replaced the React Router `location.state` bridge with an explicit,
 * shareable URL parameter. That makes the destination user-controllable, so it
 * must be validated: a `from` value is only ever honoured if it is a path on this
 * origin. Anything else falls back to `"/"`.
 *
 * Threat model — all of the following must be rejected:
 *   https://evil.example        absolute URL to another origin
 *   //evil.example              protocol-relative URL (browser treats as absolute)
 *   /\evil.example              backslash variant some parsers normalise to "/"
 *   javascript:alert(1)         script URL
 *   /\/evil.example             mixed slash/backslash
 *   \\evil.example              UNC-style path
 *   /%2F%2Fevil.example         percent-encoded protocol-relative
 *   data:,  vbscript:,  file:   other non-http schemes
 *
 * Accepted: any same-origin path, including queries and fragments:
 *   /  ·  /settings  ·  /b/design  ·  /submit?type=resource  ·  /l/x#top
 */

/** Where to send the user when no usable return path is available. */
export const DEFAULT_RETURN_PATH = "/";

/** Paths that must never be returned to: they are part of the auth flow itself. */
const AUTH_FLOW_PATHS = ["/login", "/signup", "/forgot-password", "/reset-password"];

/** Schemes that must never be honoured, belt-and-braces on top of the leading-slash check. */
const BLOCKED_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function isAuthFlowPath(pathname: string): boolean {
  return AUTH_FLOW_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`));
}

/** True when `value` contains any C0/C1 control character, DEL, or whitespace. */
function hasControlOrSpace(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if (code <= 0x1f || code === 0x7f) return true;
    if (code >= 0x80 && code <= 0x9f) return true;
    if (/\s/.test(char)) return true;
  }
  return false;
}

/**
 * Returns a safe, same-origin return path, or `DEFAULT_RETURN_PATH`.
 *
 * `raw` is untrusted: it comes from a URL a user can edit.
 */
export function sanitizeReturnPath(raw: unknown, fallback: string = DEFAULT_RETURN_PATH): string {
  if (typeof raw !== "string" || raw.length === 0) return fallback;
  // Reject control characters and whitespace outright — they have no business in
  // a path and are a classic filter-bypass vector (e.g. `java\nscript:`).
  // Written with code-point comparisons rather than a control-character regex so
  // the intent is explicit and `no-control-regex` stays clean.
  if (hasControlOrSpace(raw)) return fallback;
  // Must be an absolute *path*, not a scheme and not protocol-relative.
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//")) return fallback;
  if (raw.startsWith("/\\")) return fallback;
  if (raw.includes("\\")) return fallback;
  if (BLOCKED_SCHEME.test(raw)) return fallback;
  // Percent-encoded protocol-relative attempt ("/%2F%2Fhost").
  if (/^\/(%2f|%5c)/i.test(raw)) return fallback;

  // Split off the query/fragment so the pathname check cannot be fooled.
  const pathname = raw.split(/[?#]/, 1)[0];
  if (isAuthFlowPath(pathname)) return fallback;

  return raw;
}

/** Builds the login URL that carries a return path. */
export function loginPath(from?: string | null): string {
  const safe = sanitizeReturnPath(from, "");
  // `from` is omitted entirely when it would just mean "go home".
  return safe && safe !== DEFAULT_RETURN_PATH ? `/login?from=${encodeURIComponent(safe)}` : "/login";
}

/** Reads the validated return path from a `?from=` value. */
export function readReturnPath(from: string | null | undefined): string {
  return sanitizeReturnPath(from);
}
