"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Client-side redirect for paths that only ever forwarded in the React Router
 * table (`App.tsx`: /b → /communities, /p → /, /f → /, /u → /, /following → /).
 *
 * A plain `redirect()` in the page would also work, but these already-app-free
 * pages must stay client components like every other shell, and keeping the
 * redirect in one place means the App Router behaves exactly like the Vite app
 * (client navigation, back button preserved via `replace`).
 */
export function RedirectTo({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [router, href]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm text-muted-foreground">Redirecting…</span>
    </div>
  );
}
