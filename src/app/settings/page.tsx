import { hasServerAuth, getServerSession } from "@/lib/server-session";
import { SettingsShell } from "./settings-shell";

/**
 * `/settings` — the server-rendered private page (Phase 1.2).
 *
 * This route is the reference implementation for later private pages:
 *
 *   1. **Identity is resolved on the server**, from the `@supabase/ssr` cookie
 *      session, before any markup is produced (`getServerSession` →
 *      `getServerUser` → `auth.getUser()`).
 *   2. **Access is enforced on the server.** An anonymous request renders without
 *      a session and is redirected to `/login?from=%2Fsettings` from the render
 *      phase, so the private tree is never entered.
 *   3. **Only identity crosses the boundary.** The user id and email — both from
 *      Supabase Auth — are passed to the client shell. Nothing from application
 *      data (`profiles`, posts, drafts) is read here.
 *
 * This file has no `"use client"`: it is a Server Component. Everything
 * browser-dependent lives behind `./settings-shell.tsx`.
 *
 * Demo mode / unconfigured builds have no cookie session to verify, so this page
 * passes no session and the shell falls back to `AuthGate`, which reads the
 * browser-local mock session.
 */
/**
 * Never prerender or cache this route. It renders per-user private content, and
 * without this Next would statically generate the unconfigured branch at build
 * time (the build machine has no Supabase env) and could serve that to a real
 * authenticated visitor.
 */
export const dynamic = "force-dynamic";

export default async function SettingsRoute() {
  // Unconfigured / demo: nothing for the server to verify. `AuthGate` decides.
  if (!hasServerAuth()) return <SettingsShell />;

  // Configured: resolve identity server-side. `getServerSession` returns null for
  // an anonymous request; the shell then renders the guard, which performs the
  // redirect — and `proxy.ts` has already redirected most of these requests
  // before this page runs at all.
  const session = await getServerSession();

  return (
    <SettingsShell session={session ? { uid: session.uid, email: session.email } : undefined} />
  );
}
