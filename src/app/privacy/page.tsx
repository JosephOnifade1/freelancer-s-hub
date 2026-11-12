"use client";

import nextDynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Client-only shell — the view reads the Supabase session and browser storage at
// render time, so it is mounted with `ssr: false` (see src/app/page.tsx).
const View = nextDynamic(() => import("@/views/Privacy"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function PrivacyRoute() {
  return <View />;
}
