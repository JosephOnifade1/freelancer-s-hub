"use client";

import nextDynamic from "next/dynamic";
import { AuthGate } from "@/components/AuthGate";
import { ServerSessionBridge } from "@/components/ServerSessionBridge";

/**
 * Client boundary for `/settings` (Phase 1.2).
 *
 * The route page (`page.tsx`) is a Server Component: it resolves and enforces
 * identity, then renders this shell. Everything browser-dependent — the Supabase
 * browser client, `AuthProvider` state, the interactive form — lives behind this
 * `"use client"` line, so the server page never imports a client-only module.
 *
 * The view is mounted with `ssr: false` exactly as before: it reads the Supabase
 * session and browser storage at render time, so it must not be prerendered.
 */

const View = nextDynamic(() => import("@/views/Settings"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
    </div>
  ),
});

export interface SettingsShellProps {
  /**
   * Server-verified identity. `undefined` means the server could not verify a
   * session because Supabase is unconfigured or in demo mode — in which case
   * `AuthGate` (the browser-local session guard) owns protection instead.
   */
  session?: { uid: string; email: string | null };
}

export function SettingsShell({ session }: SettingsShellProps) {
  // No server-verifiable session (demo mode / unconfigured): the browser-local
  // mock session is the only identity available, so the client guard applies.
  if (!session) {
    return (
      <AuthGate>
        <View />
      </AuthGate>
    );
  }

  // Server already enforced access; hand the verified identity to client code.
  return (
    <>
      <ServerSessionBridge session={session} />
      <View />
    </>
  );
}
