"use client";

import nextDynamic from "next/dynamic";
import {useAuth} from "@/hooks/auth-context";
import { Loader2 } from "lucide-react";

// These routes are client-rendered shells only: every view reads the Supabase
// session, localStorage drafts or window measurements at render time, so it is
// mounted with `ssr: false`. The prerendered HTML is just the spinner below, so
// server and client markup match and there is no hydration mismatch.

const Feed = nextDynamic(() => import("@/views/Index"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

const Landing = nextDynamic(()=>import("@/views/Landing"),{ssr:false});
export default function Home() {
  const {user,loading,authError}=useAuth();
  if(loading&&!authError)return <div role="status" className="min-h-screen flex items-center justify-center">Loading…</div>;
  return user && !authError ? <Feed /> : <Landing />;
}
