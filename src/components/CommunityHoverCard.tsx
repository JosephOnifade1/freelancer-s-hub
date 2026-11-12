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
      <HoverCardContent className="w-80 p-0 overflow-hidden border-border/40 shadow-2xl bg-card/95 backdrop-blur-md rounded-2xl">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-muted animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
              </div>
            </div>
            <div className="h-16 w-full bg-muted animate-pulse rounded-lg" />
          </div>
        ) : community ? (
          <div className="relative">
            {/* Custom Cover Banner based on Community category */}
            <div className={cn(
              "h-16 w-full bg-gradient-to-br",
              style?.bgGradient || "from-primary/20 via-brand/10 to-transparent"
            )} />
            
            <div className="px-5 pb-5 -mt-8">
              <div className="flex items-end justify-between mb-3">
                <div className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-xl border-2 border-card shadow-lg ring-2 ring-border",
                  style?.iconBg || "bg-primary/10 text-primary"
                )}>
                  {IconComp && <IconComp className="h-7 w-7" />}
                </div>
                
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/50 border border-border/50">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-bold text-foreground">
                    {community.memberCount?.toLocaleString() || 0} <span className="text-muted-foreground font-medium text-[9px] uppercase tracking-tighter">Members</span>
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-heading text-base font-bold text-foreground leading-tight">
                  b/{community.slug}
                </h3>
                <p className="font-body text-xs text-muted-foreground">
                  {community.name} Space
                </p>
              </div>

              {community.description && (
                <p className="mt-3 font-body text-sm text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                  {community.description}
                </p>
              )}

              {community.topics && community.topics.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {community.topics.slice(0, 3).map((topic) => (
                    <Badge
                      key={topic}
                      variant="secondary"
                      className="bg-primary/5 hover:bg-primary/10 border-primary/10 text-[9px] py-0 px-2 rounded-md transition-colors"
                    >
                      #{topic}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                <Link
                  href={`/b/${slug}`}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary transition-all border border-primary/20"
                >
                  Visit Community
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Community not found</p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
