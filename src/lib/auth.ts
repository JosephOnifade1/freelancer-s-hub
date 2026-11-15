import { authClient } from "./auth-client";
import { getErrorMessage } from "./utils";
import { sanitizeReturnPath, DEFAULT_RETURN_PATH } from "./return-path";

/**
 * Shared helpers for the auth completion flows (login redirect,
 * email confirmation resend, password reset). All functions throw
 * on error — callers decide how to present it.
 */

export const USERNAME_RE = /^[a-z0-9_]{3,15}$/;

export const normalizeUsername = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15);

export const isValidUsername = (username: string): boolean => USERNAME_RE.test(username);


/**
 * Where to send a user after a successful login/signup.
 *
 * Phase 1: the destination now travels in the URL (`/login?from=…`) instead of
 * React Router `location.state`, so it is validated through `sanitizeReturnPath`
 * — an unvalidated value here would be an open redirect.
 */
export function postAuthRedirect(from: string | null | undefined): string {
  return sanitizeReturnPath(from, DEFAULT_RETURN_PATH);
}

export function authErrorMessage(error: unknown, fallback: string): string {
  return getErrorMessage(error, fallback);
}

export async function resendConfirmationEmail(email: string): Promise<void> {
  const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/login" });
  if (error) throw new Error("Could not request verification. Please retry later.");
}
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
  if (error) throw new Error("Could not request password recovery. Please retry later.");
}
export async function updatePassword(newPassword: string, token: string): Promise<void> {
  const { error } = await authClient.resetPassword({ newPassword, token });
  if (error) throw new Error("Reset link invalid or expired. Request another link.");
}
