import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Flag, Loader2, Clock, ShieldCheck } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { QueryErrorState } from "@/components/QueryErrorState";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth-context";
import { fetchMyReports, type Report } from "@/lib/reports";
import { formatTimeAgo, cn } from "@/lib/utils";

const STATUS_LABELS: Record<Report["status"], { label: string; color: string }> = {
  open: { label: "Open", color: "bg-brand/10 text-brand border-brand/20" },
  resolved: { label: "Resolved", color: "bg-success/10 text-success border-success/20" },
  dismissed: { label: "Dismissed", color: "bg-muted/50 text-muted-foreground border-border" },
};

export default function MyReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<Report["status"] | "all">("all");

  const { data: reports = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["my-reports", user?.uid],
    queryFn: () => (user?.uid ? fetchMyReports(user.uid) : []),
    enabled: !!user?.uid,
  });

  const filtered = useMemo(() => {
    if (statusFilter === "all") return reports;
    return reports.filter((r) => r.status === statusFilter);
  }, [reports, statusFilter]);

  if (!user) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <h2 className="font-heading text-2xl font-bold mb-2">Sign in to view your reports</h2>
          <p className="text-sm text-muted-foreground">Log in to see reports you've filed.</p>
        </div>
      </AppLayout>
    );
  }

  if (isError) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-xl px-4 py-16">
          <QueryErrorState title="Couldn't load your reports" onRetry={() => refetch()} />
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const openCount = reports.filter((r) => r.status === "open").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved").length;
  const dismissedCount = reports.filter((r) => r.status === "dismissed").length;

  const ENTITY_LINKS: Record<Report["entityType"], (id: string) => string> = {
    post: (id) => `/p/${id}`,
    comment: (id) => `/p/${id}`,
    lead: (id) => `/l/${id}`,
    profile: (id) => `/f/${id}`,
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <PageHeader
          title="My Reports"
          subtitle={`Reports you've filed and their review status`}
        />

        {/* Summary stats */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl border border-border bg-card">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Total filed</div>
            <div className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
              {reports.length}
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-border bg-card">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Open</div>
            <div className="mt-1 font-display text-2xl font-bold text-amber-800 tabular-nums">
              {openCount}
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-border bg-card">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Resolved</div>
            <div className="mt-1 font-display text-2xl font-bold text-emerald-800 tabular-nums">
              {resolvedCount}
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-border bg-card">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Dismissed</div>
            <div className="mt-1 font-display text-2xl font-bold text-muted-foreground tabular-nums">
              {dismissedCount}
            </div>
          </div>
        </div>

        {/* Status filter */}
        <div className="mb-6 flex gap-2">
          {(["all", "open", "resolved", "dismissed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full px-3.5 py-1.5 font-mono text-[11px] font-medium capitalize transition-colors",
                statusFilter === s
                  ? "bg-brand/10 text-brand border-brand/20"
                  : "bg-muted/50 text-muted-foreground border-border hover:text-foreground hover:border-brand/30"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Flag}
            title={`No ${statusFilter === "all" ? "reports" : statusFilter + " reports"}`}
            description={
              statusFilter === "all"
                ? "You haven't filed any reports yet. Use the Report button on posts, comments, or leads to flag content for moderation."
                : `No reports with a status of "${statusFilter}".`
            }
            action={
              statusFilter === "all" ? (
                <Link to="/" className="rounded-radius-md bg-primary px-4 py-2 font-body text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                  Browse posts
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((report) => {
              const status = STATUS_LABELS[report.status];
              return (
                <article
                  key={report.id}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-body text-[11px] font-semibold capitalize border ${status.color}`}
                    >
                      {status.label}
                    </span>
                    <span
                      className="ml-auto font-body text-xs text-muted-foreground"
                    >
                      {formatTimeAgo(report.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-body text-xs text-muted-foreground">
                      {report.entityType} report
                    </span>
                    <span className="font-body text-xs text-muted-foreground">
                      Reason: {report.reason}
                    </span>
                  </div>

                  <p className="mt-0.5 font-body text-sm text-foreground">
                    Reported <Link to={`/f/${report.reporter?.username || report.reporterUid}`} className="font-semibold hover:text-brand">{report.reporter?.name || "a member"}</Link>{" "}
                    ·{" "}
                    <Link to={ENTITY_LINKS[report.entityType](report.entityId)} className="font-semibold text-brand hover:underline">
                      View {report.entityType}
                    </Link>
                  </p>

                  {report.details && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-body text-sm leading-relaxed text-muted-foreground">
                      {report.details}
                    </p>
                  )}

                  {report.status === "resolved" && report.resolvedBy && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Resolved by a moderator.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
