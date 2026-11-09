import * as React from "react";
import { cn } from "@/lib/utils";

/* ─── Base skeleton ──────────────────────────────────────────── */

const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("animate-shimmer rounded-radius bg-shimmer", className)}
    {...props}
  />
));
Skeleton.displayName = "Skeleton";

/* ─── Skeleton text lines ───────────────────────────────────── */

interface SkeletonTextProps {
  /** Number of text lines to render */
  count?: number;
  /** Width of each line ("full" | "half" | "third" | CSS width) */
  width?: "full" | "half" | "third" | string;
  className?: string;
}

const lineWidth = (width: SkeletonTextProps["width"]): string => {
  if (typeof width === "string" && !["full", "half", "third"].includes(width)) {
    return width;
  }
  switch (width) {
    case "half":
      return "w-2/3";
    case "third":
      return "w-1/2";
    default:
      return "w-full";
  }
};

const SkeletonText = React.forwardRef<
  HTMLDivElement,
  SkeletonTextProps
>(({ count = 3, width = "full", className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-3", className)}
    {...props}
  >
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className={cn(lineWidth(width), "h-4")} />
    ))}
  </div>
));
SkeletonText.displayName = "SkeletonText";

/* ─── Skeleton circle (avatar) ──────────────────────────────── */

const SkeletonCircle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("animate-shimmer rounded-full bg-shimmer h-10 w-10 shrink-0", className)}
    {...props}
  />
));
SkeletonCircle.displayName = "SkeletonCircle";

/* ─── Composite: post card skeleton ─────────────────────────── */

const SkeletonPostCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-4 p-5", className)}
    {...props}
  >
    {/* Header row: avatar + title lines */}
    <div className="flex gap-3">
      <SkeletonCircle className="h-10 w-10" />
      <div className="flex-1 space-y-2">
        <Skeleton className="w-1/3 h-5" />
        <Skeleton className="w-full h-4" />
      </div>
    </div>

    {/* Body: text lines */}
    <div className="space-y-2">
      <SkeletonText count={3} width="full" />
      <SkeletonText count={1} width="half" />
    </div>

    {/* Footer: meta line */}
    <div className="flex items-center gap-4">
      <Skeleton className="w-1/4 h-4" />
      <Skeleton className="w-1/6 h-4" />
      <Skeleton className="w-1/6 h-4" />
    </div>
  </div>
));
SkeletonPostCard.displayName = "SkeletonPostCard";

export {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  SkeletonPostCard,
};
