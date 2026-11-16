import React, { useState, useEffect } from "react";
import { AppLink as Link } from "@/components/AppLink";
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
  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', handle],
    queryFn: () => handle ? getUserProfile(handle) : null,
    enabled: !!handle,
  });

  const loading = isLoading;
  const veteranStatus = profile ? isVeteran(profile.reputation || 0) : false;

  return (
    <HoverCard openDelay={300}>
      <HoverCardTrigger asChild>
        <Link 
          href={profile?.uid ? `/f/${profile.uid}` : `/f/${handle}`} 
          className="text-brand hover:underline font-medium decoration-brand/30 underline-offset-2"
        >
          {children}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 p-0 overflow-hidden border border-line shadow-2xl bg-surface rounded-xl">
        {loading ? (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md bg-sunken skeleton-bx" />
              <div className="space-y-2 flex-1">
                <div className="h-3.5 w-28 bg-sunken skeleton-bx rounded" />
                <div className="h-3 w-16 bg-sunken skeleton-bx rounded" />
              </div>
            </div>
            <div className="h-16 w-full bg-sunken skeleton-bx rounded-md" />
          </div>
        ) : profile ? (
          <div className="relative">
            <div className="h-12 w-full bg-sunken hairline-b" />
            
            <div className="px-4 pb-4 -mt-6">
              <div className="flex items-end justify-between mb-2.5">
                <div className="relative group">
                  <Avatar className="h-14 w-14 rounded-lg border-2 border-line bg-surface-raised shadow-md">
                    <AvatarImage src={profile.avatarUrl} className="rounded-lg object-cover" />
                    <AvatarFallback className="bg-sunken text-ink text-lg font-heading rounded-lg">
                      {profile.initial}
                    </AvatarFallback>
                  </Avatar>
                  {profile.isVerifiedPro && (
                    <div className="absolute -bottom-1 -right-1">
                      <VerifiedBadge size={16} isVerified={true} />
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sunken border border-line">
                  <Star className="h-3.5 w-3.5 text-gold fill-gold" />
                  <span className="num text-xs font-bold text-ink">
                    {profile.reputation?.toLocaleString() || 0} <span className="eyebrow text-[9px] text-ink-3">Karma</span>
                  </span>
                </div>
              </div>

              <div className="space-y-0.5">
                <h3 className="font-heading text-base font-bold text-ink leading-tight flex items-center gap-1.5">
                  {profile.displayName}
                  {profile.isVerifiedPro && <VerifiedBadge size={14} isVerified={true} />}
                </h3>
                <p className="num text-xs text-ink-3">
                  f/{profile.username}
                </p>
              </div>

              {profile.bio && (
                <p className="mt-2.5 text-xs text-ink-2 line-clamp-2 leading-relaxed">
                  {profile.bio}
                </p>
              )}

              {/* 3-stat overview */}
              <div className="num mt-3 grid grid-cols-3 gap-1 text-center">
                <div className="rounded bg-sunken px-1.5 py-1 border border-line">
                  <span className="block text-[12px] font-semibold text-ink">{profile.reputation?.toLocaleString() || 0}</span>
                  <span className="eyebrow block text-[8.5px]">Karma</span>
                </div>
                <div className="rounded bg-sunken px-1.5 py-1 border border-line">
                  <span className="block text-[12px] font-semibold text-ink">{profile.followers || 0}</span>
                  <span className="eyebrow block text-[8.5px]">Followers</span>
                </div>
                <div className="rounded bg-sunken px-1.5 py-1 border border-line">
                  <span className="block text-[12px] font-semibold text-ink">{profile.status || "Active"}</span>
                  <span className="eyebrow block text-[8.5px]">Status</span>
                </div>
              </div>

              {profile.skills && profile.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {profile.skills.slice(0, 4).map((skill) => (
                    <span key={skill} className="tag text-[9.5px]">
                      {skill}
                    </span>
                  ))}
                  {profile.skills.length > 4 && (
                    <span className="eyebrow text-[9px] self-center ml-0.5">
                      +{profile.skills.length - 4}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 pt-2.5 border-t border-line flex items-center justify-between text-ink-3">
                <div className="flex items-center gap-3 text-[11px]">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-ink-4" />
                    <span>{profile.location || "Global"}</span>
                  </div>
                  <div className="flex items-center gap-1 num">
                    <CalendarDays className="h-3 w-3 text-ink-4" />
                    <span>Joined {profile.joined}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center">
            <p className="text-xs text-ink-3">Profile not found at f/{handle}.</p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
