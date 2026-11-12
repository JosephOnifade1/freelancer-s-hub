"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const PostDetailPage = dynamic(() => import("@/views/PostDetail"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function PostRoute() {
  return <PostDetailPage />;
}
