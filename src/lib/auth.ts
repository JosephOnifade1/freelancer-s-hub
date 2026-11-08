import { supabase } from "./supabase";

/**
 * Shared helpers for the auth completion flows (login redirect,
 * email confirmation resend, password reset). All functions throw
 * on error — callers decide how to present it.
 */

export const USERNAME_RE = /^[a-z0-9_]{3,15}$/;

export const normalizeUsername = (raw: string): string =>
  raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15);

export const isValidUsername = (username: string): boolean => USERNAME_RE.test(username);

type LocationLike = { pathname?: string; search?: string } | undefined;

/**
 * Where to send a user after a successful login/signup: back to the
 * page ProtectedRoute originally bounced them from, else home.
 */
export function postAuthRedirect(state: unknown): string {
  const from = (state as { from?: LocationLike } | null | undefined)?.from;
  if (
    from?.pathname &&
    from.pathname !== "/login" &&
    from.pathname !== "/signup" &&
    from.pathname !== "/forgot-password"
  ) {
    return `${from.pathname}${from.search ?? ""}`;
  }
  return "/";
}

export function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
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
