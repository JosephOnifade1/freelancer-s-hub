"use client";

import { ComingSoon } from "@/components/ComingSoon";

/**
 * `/pricing` — public coming-soon page.
 *
 * Phase 0.5 route-coverage audit: this path existed in the legacy SPA
 * (`StandaloneComingSoon` in `src/App.tsx`) but had no App Router equivalent, so
 * it 404'd on the canonical runtime. This is a client component only because
 * `ComingSoon` renders a link; there is no data fetching.
 */
export default function PricingRoute() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <ComingSoon title="Pricing" description="Our pricing plans will be available soon." backTo="/" />
    </div>
  );
}
