"use client";

import { ComingSoon } from "@/components/ComingSoon";

/**
 * `/status` — public coming-soon page.
 *
 * Phase 0.5 route-coverage audit: present in the legacy SPA, previously 404 on
 * the App Router. See `/pricing`.
 */
export default function StatusRoute() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <ComingSoon
        title="System Status"
        description="Detailed uptime monitoring is being built."
        backTo="/"
      />
    </div>
  );
}
