"use client";

import nextDynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// These routes are client-rendered shells only: every view reads the Supabase
// session, localStorage drafts or window measurements at render time, so it is
// mounted with `ssr: false`. The prerendered HTML is just the spinner below, so
// server and client markup match and there is no hydration mismatch.

const View = nextDynamic(() => import("@/views/CommunityDetail"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function SpaceRoute() {
  return <View />;
}
