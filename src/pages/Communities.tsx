import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Compass, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { CreateCommunityModal } from "@/components/modals/CreateCommunityModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchAllCommunities,
  getCommunityStyle,
  getUserCommunities,
  joinCommunity,
  leaveCommunity,
} from "@/lib/communities";

type SortKey = "members" | "newest" | "name";
const PAGE_SIZE = 10;

const Communities = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("members");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const { data: communities = [], isLoading } = useQuery({
    queryKey: ["communities"],
    queryFn: fetchAllCommunities,
  });

  const { data: joinedList = [] } = useQuery({
    queryKey: ["userCommunities", user?.uid],
    queryFn: () => (user?.uid ? getUserCommunities(user.uid) : []),
    enabled: !!user?.uid,
  });
  const joined = useMemo(() => new Set(joinedList), [joinedList]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["userCommunities", user?.uid] });
    queryClient.invalidateQueries({ queryKey: ["communities"] });
  };

  const joinMutation = useMutation({
    mutationFn: (slug: string) => {
      if (!user) throw new Error("Sign in to join spaces");
      return joinCommunity(user.uid, slug);
    },
    onSuccess: (_, slug) => { refresh(); toast.success(`Joined b/${slug}`); },
    onError: (e: any) => toast.error(e.message || "Couldn't join this space"),
  });

  const leaveMutation = useMutation({
    mutationFn: (slug: string) => {
      if (!user) throw new Error("Sign in first");
      return leaveCommunity(user.uid, slug);
    },
    onSuccess: (_, slug) => { refresh(); toast.success(`Left b/${slug}`); },
    onError: (e: any) => toast.error(e.message || "Couldn't leave this space"),
  });

  // Category chips come from the categories that actually exist in the data,
  // so a chip never shows (0) and nothing is hidden behind a missing chip.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    communities.forEach((c) => counts.set(c.category, (counts.get(c.category) || 0) + 1));
    return [
      { id: "All", count: communities.length },
      ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count })),
    ];
  }, [communities]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = communities.filter((c) => {
      const inCategory = category === "All" || c.category === category;
      const inSearch = !q || c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
      return inCategory && inSearch;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return b.memberCount - a.memberCount;
    });
  }, [communities, category, search, sortBy]);

  const mySpaces = useMemo(() => communities.filter((c) => joined.has(c.slug)), [communities, joined]);
  const topSpaces = useMemo(() => [...communities].sort((a, b) => b.memberCount - a.memberCount).slice(0, 5), [communities]);

  const toggle = (slug: string, isJoined: boolean) => (isJoined ? leaveMutation.mutate(slug) : joinMutation.mutate(slug));

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1340px] px-4 py-6 md:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">Spaces</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                B-Spaces are topic communities for freelancers. Join the ones that match the work you do.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setVisible(PAGE_SIZE); }}
                  placeholder="Search spaces"
                  className="h-10 pl-9"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                aria-label="Sort spaces"
                className="h-10 cursor-pointer rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="members">Most members</option>
                <option value="newest">Newest</option>
                <option value="name">A to Z</option>
              </select>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => { setCategory(cat.id); setVisible(PAGE_SIZE); }}
                    className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    }`}
                  >
                    {cat.id === "All" ? "All spaces" : cat.id} <span className="ml-1 font-mono opacity-60">{cat.count}</span>
                  </button>
                );
              })}
            </div>

            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {isLoading && <p className="p-10 text-center text-sm text-muted-foreground">Loading spaces</p>}
              {!isLoading && list.length === 0 && (
                <p className="p-10 text-center text-sm text-muted-foreground">
                  {search ? `No spaces match "${search}".` : "No spaces in this category yet."}
                </p>
              )}
              {list.slice(0, visible).map((space, i) => {
                const Icon = getCommunityStyle(space.category).icon;
                const isJoined = joined.has(space.slug);
                return (
                  <motion.div
                    key={space.slug}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 6) * 0.03 }}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/40"
                  >
                    <Link to={`/b/${space.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {space.name} <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">b/{space.slug}</span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{space.description}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {space.memberCount.toLocaleString()} {space.memberCount === 1 ? "member" : "members"}
                        </p>
                      </div>
                    </Link>
                    <Button
                      variant={isJoined ? "ghost" : "outline"}
                      size="sm"
                      disabled={joinMutation.isPending || leaveMutation.isPending}
                      onClick={() => toggle(space.slug, isJoined)}
                      className="shrink-0 gap-1.5"
                    >
                      {isJoined ? <><Check className="h-3.5 w-3.5" /> Joined</> : "Join"}
                    </Button>
                  </motion.div>
                );
              })}
            </div>

            {visible < list.length && (
              <div className="text-center">
                <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  Show {Math.min(PAGE_SIZE, list.length - visible)} more
                </Button>
              </div>
            )}
          </div>

          <aside className="space-y-4 lg:col-span-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-heading text-sm font-bold text-foreground">Start your own space</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Pick a name and a niche. You become the first member and can invite others with the space link.
              </p>
              <CreateCommunityModal>
                <Button variant="outline" className="mt-4 w-full gap-1.5">
                  <Plus className="h-4 w-4" /> Create space
                </Button>
              </CreateCommunityModal>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 font-heading text-sm font-bold text-foreground">Your spaces</h2>
              {!user ? (
                <p className="text-sm text-muted-foreground">Sign in to see the spaces you've joined.</p>
              ) : mySpaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">You haven't joined any spaces yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {mySpaces.map((s) => (
                    <li key={s.slug}>
                      <Link to={`/b/${s.slug}`} className="flex items-center justify-between text-sm hover:opacity-80">
                        <span className="font-medium text-foreground">{s.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">b/{s.slug}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-sm font-bold text-foreground">
                <Compass className="h-4 w-4 text-muted-foreground" /> Largest spaces
              </h2>
              {topSpaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing to rank yet.</p>
              ) : (
                <ol className="space-y-2.5">
                  {topSpaces.map((s, i) => (
                    <li key={s.slug}>
                      <Link to={`/b/${s.slug}`} className="flex items-center gap-3 text-sm hover:opacity-80">
                        <span className="w-3 font-mono text-xs text-muted-foreground">{i + 1}</span>
                        <span className="flex-1 truncate font-medium text-foreground">{s.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{s.memberCount.toLocaleString()}</span>
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

export default Communities;
