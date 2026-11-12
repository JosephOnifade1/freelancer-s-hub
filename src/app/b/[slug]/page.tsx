"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const CommunityDetailPage = dynamic(() => import("@/views/CommunityDetail"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function SpaceRoute() {
  return <CommunityDetailPage />;
}
