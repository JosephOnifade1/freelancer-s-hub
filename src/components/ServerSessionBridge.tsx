"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Seeds the client cache from a server-verified session (Phase 1.2).
 *
 * The private route page resolves identity on the server and passes it down as
 * serialisable props. This component registers it under the same query key the
 * client uses (`["serverSession"]`), so a client component can read the
 * server-verified identity without fetching it again — the "no duplicate session
 * fetching" requirement, expressed as a cache seed rather than a second network
 * call.
 *
 * Why a seed instead of more props: the page shell is client-rendered during this
 * phase (see `src/app/settings/page.tsx`), so the *static* server markup cannot
 * carry authenticated detail — the app's client render is gated on the client
 * session resolving (`AuthProvider` renders `!loading && children`), which would
 * otherwise discard it. Seeding the shared cache is the honest way to hand
 * server-verified identity to client code today, and it becomes plain prop
 * passing once a page is fully server-rendered.
 */
export function ServerSessionBridge({ session }: { session: { uid: string; email: string | null } }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.setQueryData(["serverSession"], session);
  }, [queryClient, session]);

  return null;
}
