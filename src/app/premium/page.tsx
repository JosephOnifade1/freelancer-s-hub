"use client";

import { ComingSoon } from "@/components/ComingSoon";
import { AppLayout } from "@/components/AppLayout";
import { AuthGate } from "@/components/AuthGate";

/**
 * `/premium` — authenticated coming-soon page.
 *
 * Phase 0.5 route-coverage audit: present in the legacy SPA (wrapped in
 * `ProtectedRoute` there), previously 404 on the App Router.
 *
 * Phase 1: now wrapped in `AuthGate` like every other private route, matching the
 * `ProtectedRoute` wrapper the legacy SPA route table carries.
 */
export default function PremiumRoute() {
  return (
    <AuthGate>
      <AppLayout>
        <ComingSoon title="Premium" description="Borynx Premium is currently in development." backTo="/" />
      </AppLayout>
    </AuthGate>
  );
}
