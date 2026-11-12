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
    queryKey: ["leads"], queryFn: fetchLeads,
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
            <AppLink {...publish} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-radius-md bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Plus className="h-4 w-4" /> Post opportunity
            </AppLink>
          }
        />
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search opportunities</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search skills, title or location" className="pl-9" />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Type
            <select aria-label="Filter opportunity type" value={type} onChange={(event) => setType(event.target.value as (typeof TYPES)[number])} className="min-h-10 rounded-radius-md border border-border bg-background px-3 font-body text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {TYPES.map((value) => <option key={value} value={value}>{value === "All" ? "All types" : value}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Sort
            <select aria-label="Sort opportunities" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="min-h-10 rounded-radius-md border border-border bg-background px-3 font-body text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="newest">Newest</option>
              <option value="most-applicants">Most applicants</option>
            </select>
          </label>
        </div>

        {user && (
          <Link to="/pipeline" className="mb-5 inline-flex text-sm font-semibold text-brand hover:underline">
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
