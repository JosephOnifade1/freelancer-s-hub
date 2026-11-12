"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * `/u/[username]` — legacy profile URL redirect to `/f/[handle]`.
 *
 * Phase 0.5 route-coverage audit: the SPA routed `/u/:username` through
 * `LegacyProfileRedirect` (`<Navigate to={/f/${username}} replace>`), but the App
 * Router had no equivalent, so old links 404'd on the canonical runtime.
 *
 * Implemented natively (no React Router, no compatibility adapter) and mounted
 * client-side only, so `router.replace` only runs in the browser.
 */
export default function LegacyProfileRedirect() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();

  useEffect(() => {
    if (username) router.replace(`/f/${username}`);
  }, [username, router]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center" role="status">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-muted" />
        <p className="text-sm text-muted-foreground font-body">Redirecting to profile…</p>
      </div>
    </div>
  );
}
