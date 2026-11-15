import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/server/auth";
import { authConfigured } from "@/server/auth/config";
import { loginPath } from "./return-path";
import { isValidUid } from "@/server/features/identity/provision-profile";
export interface ServerSession { uid: string; email: string | null; emailVerified: boolean; displayName?: string | null }
export async function getServerSession(): Promise<ServerSession | null> {
  if (!hasServerAuth()) return null;
  // Infrastructure failure propagates to feature-level unavailable handling;
  // it must not be fabricated as a revoked or anonymous session.
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || !session.user.emailVerified || !isValidUid(session.user.id)) return null;
  return { uid: session.user.id, email: session.user.email, emailVerified: session.user.emailVerified, displayName: session.user.name };
}
export function hasServerAuth() { return authConfigured(); }
export async function requireServerSession(path: string): Promise<ServerSession> {
  const session = await getServerSession();
  if (session) return session;
  redirect(loginPath(path));
}
