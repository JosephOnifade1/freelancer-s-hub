import { RedirectTo } from "@/lib/redirect-to";
import { AuthGate } from "@/components/AuthGate";

// Mirrors the React Router redirect in src/App.tsx so both builds agree.
// Phase 1: forwarded through `AuthGate` because the SPA wraps this route in
// `ProtectedRoute` — signed-out visitors land on /login?from=/?feed=following
// rather than the feed.
export default function Redirect() {
  return (
    <AuthGate>
      <RedirectTo href="/?feed=following" />
    </AuthGate>
  );
}
