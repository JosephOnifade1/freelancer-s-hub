import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUserProfile, getUidByUsername, UserProfile, isVeteran } from "@/lib/users";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "./VerifiedBadge";
import { Badge } from "@/components/ui/badge";
import { MapPin, CalendarDays, Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserHoverCardProps {
  handle: string; // The username (f/username)
  children: React.ReactNode;
}

export function UserHoverCard({ handle, children }: UserHoverCardProps) {
  const [uid, setUid] = useState<string | null>(null);

  // First get the UID from the handle
  const { data: foundUid, isLoading: isUidLoading } = useQuery({
    queryKey: ['uid-by-username', handle],
    queryFn: () => getUidByUsername(handle),
    enabled: !!handle,
  });

  // Then fetch the full profile
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile', foundUid || handle],
    queryFn: async () => {
      // If we found a UID via username search, use it
      if (foundUid) return getUserProfile(foundUid);
      
      // If no UID found via username, try treating the handle itself as a UID
      // (This handles cases where the link already points to a UID)
      const directProfile = await getUserProfile(handle);
      if (directProfile) return directProfile;

      return null;
    },
    enabled: !!(foundUid || handle),
  });

  const loading = isUidLoading || isProfileLoading;
  const veteranStatus = profile ? isVeteran(profile.reputation || 0) : false;

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>
        <Link 
          to={foundUid ? `/f/${foundUid}` : `/f/${handle}`} 
          className="text-primary hover:underline font-medium decoration-primary/30 underline-offset-2"
        >
          {children}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0 overflow-hidden border-border/40 shadow-2xl bg-card/95 backdrop-blur-md rounded-2xl">
        {loading ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
              </div>
            </div>
            <div className="h-20 w-full bg-muted animate-pulse rounded-lg" />
          </div>
        ) : profile ? (
          <div className="relative">
            {/* Cover Decoration */}
            <div className={cn(
              "h-20 w-full bg-gradient-to-br",
              veteranStatus 
                ? "from-amber-400/20 via-orange-500/10 to-transparent" 
                : "from-primary/20 via-purple-500/10 to-transparent"
            )} />
            
            <div className="px-5 pb-5 -mt-10">
              <div className="flex items-end justify-between mb-3">
                <div className="relative group">
                  <Avatar className={cn(
                    "h-20 w-20 border-4 border-card ring-2 ring-border shadow-lg",
                    veteranStatus && "ring-amber-500/30"
                  )}>
                    <AvatarImage src={profile.avatarUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-heading">
                      {profile.initial}
                    </AvatarFallback>
                  </Avatar>
                  {profile.isVerifiedPro && (
                    <div className="absolute -bottom-1 -right-1">
                      <VerifiedBadge size={20} isVerified={true} />
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col items-end gap-1 mb-1">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary/50 border border-border/50">
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-bold text-foreground">
                      {profile.reputation?.toLocaleString() || 0} <span className="text-muted-foreground font-medium uppercase tracking-tighter text-[9px]">Karma</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-heading text-lg font-bold text-foreground leading-tight">
                  {profile.displayName}
                </h3>
                <p className="font-body text-xs text-muted-foreground">
                  f/{profile.username}
                </p>
              </div>

              {profile.bio && (
                <p className="mt-3 font-body text-sm text-[var(--text-muted)] line-clamp-2 leading-relaxed">
                  {profile.bio}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {profile.skills?.slice(0, 3).map((skill) => (
                  <Badge key={skill} variant="secondary" className="bg-primary/5 hover:bg-primary/10 border-primary/10 text-[10px] py-0 px-2 rounded-md transition-colors">
                    {skill}
                  </Badge>
                ))}
                {profile.skills?.length > 3 && (
                  <span className="text-[10px] text-muted-foreground font-medium self-center ml-1">
                    +{profile.skills.length - 3} more
                  </span>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="flex items-center gap-1 text-[11px]">
                    <MapPin className="h-3 w-3" />
                    {profile.location || "Global"}
                  </div>
                  <div className="flex items-center gap-1 text-[11px]">
                    <CalendarDays className="h-3 w-3" />
                    Joined {profile.joined}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">User profile not found</p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
