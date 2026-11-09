import { useMemo, useState } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Globe, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { ComposerBar } from "@/components/ComposerBar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile } from "@/lib/users";
import { fetchPostsByCommunity } from "@/lib/posts";
import { QueryErrorState } from "@/components/QueryErrorState";
import {
  fetchCommunity,
  fetchCommunityMembers,
  getCommunityStyle,
  getUserCommunities,
  joinCommunity,
  leaveCommunity,
} from "@/lib/communities";

const TABS = ["Feed", "Discussions", "Resources", "Members", "About"] as const;
type Tab = (typeof TABS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CommunityDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("Feed");

  const { data: community, isLoading, isError: communityError, refetch: refetchCommunity } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => (slug ? fetchCommunity(slug) : null),
    enabled: !!slug,
  });

  const { data: posts = [], isLoading: loadingPosts, isError: postsError, refetch: refetchPosts } = useQuery({
    queryKey: ["communityPosts", slug],
    queryFn: () => (slug ? fetchPostsByCommunity(slug) : []),
    enabled: !!slug,
  });

  const { data: members = [], isError: membersError, refetch: refetchMembers } = useQuery({
    queryKey: ["communityMembers", slug],
    queryFn: () => (slug ? fetchCommunityMembers(slug) : []),
    enabled: !!slug,
  });

  const { data: joinedSlugs = [], isError: membershipError, refetch: refetchMembership } = useQuery({
    queryKey: ["userCommunities", user?.uid],
    queryFn: () => (user?.uid ? getUserCommunities(user.uid) : []),
    enabled: !!user?.uid,
  });

  const ownerId = community?.ownerId;
  const { data: owner } = useQuery({
    queryKey: ["profile", ownerId],
    queryFn: () => getUserProfile(ownerId as string),
    enabled: !!ownerId && UUID.test(ownerId),
  });

  const isJoined = !!slug && joinedSlugs.includes(slug);

  const refreshMembership = () => {
    queryClient.invalidateQueries({ queryKey: ["userCommunities", user?.uid] });
    queryClient.invalidateQueries({ queryKey: ["community", slug] });
    queryClient.invalidateQueries({ queryKey: ["communityMembers", slug] });
    queryClient.invalidateQueries({ queryKey: ["communities"] });
  };

  const joinMutation = useMutation({
    mutationFn: () => {
      if (!user?.uid) throw new Error("Sign in to join a space");
      if (!slug) throw new Error("Unknown space");
      return joinCommunity(user.uid, slug);
    },
    onSuccess: () => {
      refreshMembership();
      toast.success(`Joined b/${slug}`);
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't join this space"),
  });

  const leaveMutation = useMutation({
    mutationFn: () => {
      if (!user?.uid) throw new Error("Sign in first");
      if (!slug) throw new Error("Unknown space");
      return leaveCommunity(user.uid, slug);
    },
    onSuccess: () => {
      refreshMembership();
      toast.success(`Left b/${slug}`);
    },
    onError: (err: Error) => toast.error(err.message || "Couldn't leave this space"),
  });

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Space link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const visiblePosts = useMemo(() => {
    if (activeTab === "Discussions") return posts.filter((p) => p.type === "discussion" || p.type === "question");
    if (activeTab === "Resources") return posts.filter((p) => p.type === "resource");
    return posts;
  }, [posts, activeTab]);

  const postsToday = useMemo(() => {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return posts.filter((p) => (p.createdAt || 0) >= dayAgo).length;
  }, [posts]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (communityError) return <AppLayout><div className="mx-auto max-w-xl px-4 py-16"><QueryErrorState title="Couldn't load this space" onRetry={() => refetchCommunity()} /></div></AppLayout>;

  if (!community) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="font-heading text-xl font-bold text-foreground">This space doesn't exist</h1>
          <p className="mt-2 text-sm text-muted-foreground">b/{slug} isn't a B-Space yet. Browse the directory to find one.</p>
          <Button className="mt-6" onClick={() => navigate("/communities")}>Browse spaces</Button>
        </div>
      </AppLayout>
    );
  }

  const style = getCommunityStyle(community.category);
  const Icon = style.icon;
  const topMembers = members.slice(0, 5);
  const created = community.createdAt ? format(new Date(community.createdAt), "MMM d, yyyy") : null;

  const memberLink = (m: { uid: string; username?: string }) => `/f/${m.username || m.uid}`;
  const memberName = (m: { displayName?: string; username?: string }) => m.displayName || m.username || "Member";

  const emptyCopy: Record<string, string> = {
    Feed: "Nothing has been posted in this space yet. Start the first thread.",
    Discussions: "No discussions or questions here yet.",
    Resources: "No resources have been shared in this space yet.",
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1340px] px-4 py-5 md:px-6">
        <button
          onClick={() => navigate("/communities")}
          className="group mb-4 inline-flex items-center gap-1.5 font-body text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> All spaces
        </button>

        <header className="mb-6 rounded-xl border border-border bg-card p-5 md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground">
                <Icon className="h-7 w-7" />
              </div>
              <div className="min-w-0 space-y-1.5">
                <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{community.name}</h1>
                <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-muted-foreground">
                  <span className="tabular-nums ">b/{community.slug}</span>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Public</span>
                  <span aria-hidden>·</span>
                  <span>{community.memberCount.toLocaleString()} {community.memberCount === 1 ? "member" : "members"}</span>
                </p>
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{community.description}</p>
                {community.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {community.topics.map((t) => (
                      <Link
                        key={t}
                        to={`/tag/${t}`}
                        className="rounded-md border border-border bg-background px-2 py-0.5 font-body text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        #{t}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyInviteLink} className="gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Copy link
              </Button>
              {!user ? (
                <Button size="sm" asChild><Link to="/login" state={{ from: location }}>Sign in to join</Link></Button>
              ) : membershipError ? (
                <button type="button" onClick={() => refetchMembership()} className="text-xs text-destructive hover:underline">Couldn't check membership. Retry</button>
              ) : isJoined ? (
                <Button variant="outline" size="sm" disabled={leaveMutation.isPending} onClick={() => leaveMutation.mutate()}>
                  Joined
                </Button>
              ) : (
                <Button size="sm" disabled={joinMutation.isPending} onClick={() => joinMutation.mutate()}>
                  Join space
                </Button>
              )}
            </div>
          </div>
        </header>

        <div className="mb-6 flex items-center gap-6 overflow-x-auto border-b border-border">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative whitespace-nowrap pb-3 text-sm font-semibold transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
                {isActive && <motion.div layoutId="activeSpaceTab" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand" />}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            {(activeTab === "Feed" || activeTab === "Discussions" || activeTab === "Resources") && (
              <>
                <ComposerBar spaceSlug={community.slug} placeholder={`Post in b/${community.slug}`} />
                <div className="space-y-3">
                  {postsError ? (
                    <QueryErrorState title="Couldn't load space posts" onRetry={() => refetchPosts()} />
                  ) : loadingPosts ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : visiblePosts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
                      {emptyCopy[activeTab]}
                    </div>
                  ) : visiblePosts.map((post, i) => (
                    <PostCard key={post.id} post={post} index={i} />
                  ))}
                </div>
              </>
            )}

            {activeTab === "Members" && (
              <div className="divide-y divide-border rounded-xl border border-border bg-card">
                {membersError ? <QueryErrorState title="Couldn't load members" onRetry={() => refetchMembers()} />
                  : members.length === 0 ? <p className="p-10 text-center text-sm text-muted-foreground">No one has joined this space yet.</p>
                  : members.map((m) => (
                  <Link key={m.uid} to={memberLink(m)} className="flex items-center gap-3 p-3.5 transition-colors hover:bg-muted/50">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-muted font-heading text-sm font-bold">
                      {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" /> : memberName(m).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
                        {memberName(m)} <VerifiedBadge isVerified={m.isVerifiedPro} size={12} showTooltip={false} />
                      </p>
                      <p className="tabular-nums text-xs text-muted-foreground">f/{m.username || m.uid.slice(0, 8)}</p>
                    </div>
                    <span className="tabular-nums text-xs text-muted-foreground">{m.reputation.toLocaleString()} rep</span>
                  </Link>
                ))}
              </div>
            )}

            {activeTab === "About" && (
              <div className="space-y-5 rounded-xl border border-border bg-card p-6">
                <div>
                  <h2 className="font-heading text-sm font-bold text-foreground">About b/{community.slug}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{community.description}</p>
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Category</dt><dd className="font-medium text-foreground">{community.category}</dd></div>
                  {created && <div><dt className="text-xs text-muted-foreground">Created</dt><dd className="font-medium text-foreground">{created}</dd></div>}
                  <div><dt className="text-xs text-muted-foreground">Members</dt><dd className="font-medium text-foreground">{community.memberCount.toLocaleString()}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Posts</dt><dd className="font-medium text-foreground">{posts.length.toLocaleString()}</dd></div>
                </dl>
              </div>
            )}
          </div>

          <aside className="space-y-4 lg:col-span-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 font-heading text-sm font-bold text-foreground">About this space</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted py-2.5">
                  <div className="font-heading text-base font-bold text-foreground">{community.memberCount.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">Members</div>
                </div>
                <div className="rounded-lg bg-muted py-2.5">
                  <div className="font-heading text-base font-bold text-foreground">{posts.length.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">Posts</div>
                </div>
                <div className="rounded-lg bg-muted py-2.5">
                  <div className="font-heading text-base font-bold text-foreground">{postsToday}</div>
                  <div className="text-[11px] text-muted-foreground">Today</div>
                </div>
              </div>
              <div className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                {created && <p>Created {created}</p>}
                {owner && (
                  <p>
                    Started by{" "}
                    <Link to={`/f/${owner.username || owner.uid}`} className="font-medium text-foreground hover:underline">
                      f/{owner.username || owner.displayName}
                    </Link>
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-sm font-bold text-foreground">Top members</h2>
                {members.length > topMembers.length && (
                  <button onClick={() => setActiveTab("Members")} className="text-xs text-muted-foreground hover:text-foreground">
                    View all
                  </button>
                )}
              </div>
              {membersError ? (
                <p role="alert" className="text-xs text-destructive">Members unavailable. <button onClick={() => refetchMembers()} className="underline">Retry</button></p>
              ) : topMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Members will show up here once people join.</p>
              ) : (
                <ol className="space-y-2.5">
                  {topMembers.map((m, i) => (
                    <li key={m.uid}>
                      <Link to={memberLink(m)} className="flex items-center gap-2.5 hover:opacity-80">
                        <span className="w-3 tabular-nums text-xs text-muted-foreground">{i + 1}</span>
                        <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-muted font-heading text-[11px] font-bold">
                          {m.avatarUrl ? <img src={m.avatarUrl} alt="" className="h-full w-full object-cover" /> : memberName(m).charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 truncate text-sm font-medium text-foreground">{memberName(m)}</span>
                        <span className="tabular-nums text-[11px] text-muted-foreground">{m.reputation.toLocaleString()}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
};

export default CommunityDetail;
