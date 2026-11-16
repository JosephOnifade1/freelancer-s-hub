import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Link } from "react-router-dom";
import { AppLink } from "@/components/AppLink";
import { loginPath } from "@/lib/return-path";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { QueryErrorState } from "@/components/QueryErrorState";
import { LeadCard } from "@/components/LeadCard";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/auth-context";
import { fetchLeads, type LeadType } from "@/lib/leads";

const TYPES: ("All" | LeadType)[] = ["All", "Bounty", "Project", "Retainer", "Full-time"];
type Sort = "newest" | "most-applicants";

/** The public marketplace only displays actual rows from the leads table. */
export default function LeadsBoard() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("All");
  const [sort, setSort] = useState<Sort>("newest");
  const { data: leads = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["leads"], queryFn: () => fetchLeads(),
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads
      .filter((lead) => lead.status === "open")
      .filter((lead) => type === "All" || lead.type === type)
      .filter((lead) => !term || [lead.title, lead.description, lead.location, lead.postedBy.name, ...lead.skills]
        .some((part) => part.toLowerCase().includes(term)))
      .sort((a, b) => sort === "newest"
        ? b.postedAt - a.postedAt
        : b.applicantsCount - a.applicantsCount || b.postedAt - a.postedAt);
  }, [leads, search, sort, type]);

  const publish = user ? { href: "/l/post" } : { href: loginPath("/l/post") };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
        <PageHeader
          title="Opportunities"
          subtitle="Real, open projects posted by Borynx members. Apply without bidding credits."
          action={
            <AppLink {...publish} className="btn btn-primary btn-sm gap-2">
              <Plus className="h-3.5 w-3.5" /> Post opportunity
            </AppLink>
          }
        />
        <div className="mb-5 flex flex-col gap-3 panel rounded-xl p-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search opportunities</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search skills, title or location…"
              className="field w-full pl-9"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-3">
            <span className="eyebrow text-[9.5px]">Type</span>
            <select aria-label="Filter opportunity type" value={type} onChange={(event) => setType(event.target.value as (typeof TYPES)[number])} className="field">
              {TYPES.map((value) => <option key={value} value={value}>{value === "All" ? "All types" : value}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-3">
            <span className="eyebrow text-[9.5px]">Sort</span>
            <select aria-label="Sort opportunities" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="field">
              <option value="newest">Newest</option>
              <option value="most-applicants">Most applicants</option>
            </select>
          </label>
        </div>

        {user && (
          <Link to="/pipeline" className="mb-4 inline-flex text-xs font-semibold text-ember hover:underline">
            View your private pipeline →
          </Link>
        )}
        {isError ? (
          <QueryErrorState title="Couldn't load opportunities" onRetry={() => refetch()} />
        ) : isLoading ? (
          <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading opportunities…</p>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={search || type !== "All" ? "No opportunities match those filters" : "No open opportunities yet"}
            description={search || type !== "All"
              ? "Try another keyword or select all types."
              : "Opportunities appear here when members post a real project. Be the first to post one."}
            action={search || type !== "All"
              ? <button onClick={() => { setSearch(""); setType("All"); }} className="rounded-radius-md border border-border px-4 py-2 font-body text-sm font-medium text-foreground hover:bg-muted">Clear filters</button>
              : <AppLink {...publish} className="rounded-radius-md bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground">Post an opportunity</AppLink>}
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{visible.length} open {visible.length === 1 ? "opportunity" : "opportunities"}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {visible.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
            </div>
          </>
        )}
        {!user && <p className="mt-6 text-center text-sm text-muted-foreground">You can browse without an account. <AppLink href={loginPath(pathname)} className="font-semibold text-brand hover:underline">Sign in</AppLink> to apply or save an opportunity.</p>}
      </div>
    </AppLayout>
  );
}
