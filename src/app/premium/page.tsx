"use client";

import { ComingSoon } from "@/components/ComingSoon";
import { AppLayout } from "@/components/AppLayout";

/**
 * `/premium` — authenticated coming-soon page.
 *
 * Phase 0.5 route-coverage audit: present in the legacy SPA (wrapped in
 * `ProtectedRoute` there), previously 404 on the App Router.
 *
 * NOTE: there is deliberately no `ProtectedRoute` here. Route protection is the
 * authentication phase's job (Phase 1), and the brief forbids touching that
 * mechanism now. The page is a placeholder and exposes no data, which matches the
 * current SPA behaviour for a signed-in user.
 */
export default function PremiumRoute() {
  return (
    <AppLayout>
      <ComingSoon title="Premium" description="Borynx Premium is currently in development." backTo="/" />
    </AppLayout>
  );
}
