import React from "react";
import { AppLink as Link } from "@/components/AppLink";
import { useQuery } from "@tanstack/react-query";
import { fetchCommunity, getCommunityStyle } from "@/lib/communities";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Users, Globe, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CommunityHoverCardProps {
  slug: string;
  children: React.ReactNode;
  asChild?: boolean;
}

export function CommunityHoverCard({ slug, children, asChild = false }: CommunityHoverCardProps) {
  const { data: community, isLoading } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => (slug ? fetchCommunity(slug) : null),
    enabled: !!slug,
  });

  const style = community ? getCommunityStyle(community.category) : null;
  const IconComp = style ? style.icon : Globe;

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>
        {asChild ? (
          children
        ) : (
          <Link
            href={`/b/${slug}`}
            className="text-primary hover:underline font-semibold decoration-primary/30 underline-offset-2"
          >
            {children}
          </Link>
        )}
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0 overflow-hidden border border-line shadow-2xl bg-surface rounded-xl">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-sunken skeleton-bx" />
              <div className="space-y-2 flex-1">
                <div className="h-3.5 w-24 bg-sunken skeleton-bx rounded" />
                <div className="h-3 w-16 bg-sunken skeleton-bx rounded" />
              </div>
            </div>
            <div className="h-14 w-full bg-sunken skeleton-bx rounded-md" />
          </div>
        ) : community ? (
          <div className="relative">
            <div className="h-12 w-full bg-sunken hairline-b" />
            
            <div className="px-4 pb-4 -mt-6">
              <div className="flex items-end justify-between mb-2.5">
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-lg border-2 border-line shadow-md bg-surface-raised",
                  style?.iconBg || "text-ember"
                )}>
                  {IconComp && <IconComp className="h-6 w-6" />}
                </div>
                
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sunken border border-line">
                  <Users className="h-3 w-3 text-ink-3" />
                  <span className="num text-xs font-bold text-ink">
                    {community.memberCount?.toLocaleString() || 0} <span className="eyebrow text-[9px]">Members</span>
                  </span>
                </div>
              </div>

              <div className="space-y-0.5">
                <h3 className="font-heading text-base font-bold text-ink leading-tight">
                  <span className="text-ink-3 font-normal font-mono">b/</span>{community.slug}
                </h3>
                <p className="eyebrow text-[10px]">
                  {community.name} Space
                </p>
              </div>

              {community.description && (
                <p className="mt-2.5 text-xs text-ink-2 line-clamp-2 leading-relaxed">
                  {community.description}
                </p>
              )}

              {community.topics && community.topics.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {community.topics.slice(0, 3).map((topic) => (
                    <span
                      key={topic}
                      className="tag text-[9.5px]"
                    >
                      #{topic}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between">
                <Link
                  href={`/b/${slug}`}
                  className="btn btn-sm w-full justify-center text-xs"
                >
                  Visit Community
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center">
            <p className="text-xs text-ink-3">Community not found at b/{slug}.</p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
