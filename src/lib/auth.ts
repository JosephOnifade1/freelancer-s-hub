import { supabase } from "./supabase";
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
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${window.location.origin}/login` },
  });
  if (error) throw new Error(error.message);
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(error.message);
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
