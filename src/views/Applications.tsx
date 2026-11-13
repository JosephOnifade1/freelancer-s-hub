import { useState } from "react";
import { AppLink as Link } from "@/components/AppLink";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { QueryErrorState } from "@/components/QueryErrorState";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/hooks/auth-context";
import {
  fetchMyApplications,
  fetchReceivedApplications,
  updateApplicationStatus,
  type ApplicationStatus,
  type LeadApplication,
} from "@/lib/applications";
import { formatTimeAgo } from "@/lib/utils";
import { Briefcase, Check, Inbox, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  pending: "bg-brand/10 text-brand border-brand/20",
  accepted: "bg-success/10 text-success border-success/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  withdrawn: "bg-muted/50 text-muted-foreground border-border",
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 font-body text-[11px] font-semibold capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

const Applications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"received" | "sent">("received");

  const { data: received = [], isLoading: loadingReceived, isError: receivedError, refetch: refetchReceived } = useQuery({
    queryKey: ["receivedApplications", user?.uid],
    queryFn: () => (user?.uid ? fetchReceivedApplications(user.uid) : []),
    enabled: !!user?.uid,
  });

  const { data: sent = [], isLoading: loadingSent, isError: sentError, refetch: refetchSent } = useQuery({
    queryKey: ["myApplications", user?.uid],
    queryFn: () => (user?.uid ? fetchMyApplications(user.uid) : []),
    enabled: !!user?.uid,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      updateApplicationStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["receivedApplications"] });
      queryClient.invalidateQueries({ queryKey: ["myApplications"] });
      queryClient.invalidateQueries({ queryKey: ["myApplication"] });
      queryClient.invalidateQueries({ queryKey: ["lead"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        variables.status === "accepted"
          ? "Application accepted. The freelancer can see the update on the lead."
          : variables.status === "rejected"
            ? "Application rejected."
            : "Application withdrawn."
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update application."),
  });

  const isLoading = tab === "received" ? loadingReceived : loadingSent;
  const isError = tab === "received" ? receivedError : sentError;
  const retry = tab === "received" ? refetchReceived : refetchSent;
  const active = tab === "received" ? received : sent;
  const pendingReceived = received.filter((a) => a.status === "pending").length;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <PageHeader
          title="Applications"
          subtitle="Review proposals for opportunities you posted, and track the ones you've sent."
        />

        {/* Tabs */}
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setTab("received")}
            className={`inline-flex items-center gap-2 rounded-radius-md px-4 py-2 font-mono text-[11px] font-medium transition-colors ${
              tab === "received" ? "bg-brand/10 text-brand border-brand/20" : "bg-muted/50 text-muted-foreground border-border hover:text-foreground hover:border-brand/30"
            }`}
          >
            <Inbox className="h-4 w-4" /> Received
            {pendingReceived > 0 && (
              <span className="rounded-full bg-brand px-1.5 font-mono text-[10px] font-bold text-brand-foreground">
                {pendingReceived}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("sent")}
            className={`inline-flex items-center gap-2 rounded-radius-md px-4 py-2 font-mono text-[11px] font-medium transition-colors ${
              tab === "sent" ? "bg-brand/10 text-brand border-brand/20" : "bg-muted/50 text-muted-foreground border-border hover:text-foreground hover:border-brand/30"
            }`}
          >
            <Send className="h-4 w-4" /> Sent
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {isError ? <QueryErrorState title="Couldn't load applications" onRetry={() => retry()} /> : isLoading ? (
            <div className="flex h-[40vh] items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : active.length === 0 ? (
            tab === "received" ? (
              <EmptyState
                icon={Inbox}
                title="No applications yet"
                description="When freelancers apply to opportunities you post, their proposals will show up here for review."
                action={
                  <Link href="/l/post" className="rounded-radius-md bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                    Post an opportunity
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={Briefcase}
                title="You haven't applied to anything"
                description="Browse opportunities and send your first proposal — it'll be tracked here."
                action={
                  <Link href="/l" className="rounded-radius-md bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                    Browse opportunities
                  </Link>
                }
              />
            )
          ) : (
            active.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app}
                mode={tab}
                busy={statusMutation.isPending}
                onStatus={(status) => statusMutation.mutate({ id: app.id, status })}
              />
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

function ApplicationCard({
  app,
  mode,
  busy,
  onStatus,
}: {
  app: LeadApplication;
  mode: "received" | "sent";
  busy: boolean;
  onStatus: (status: ApplicationStatus) => void;
}) {
  const applicant = app.applicant;

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start gap-3">
        {mode === "received" && applicant ? (
          <Link href={`/f/${applicant.username || applicant.uid}`} className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-heading text-sm font-bold text-foreground">
              {applicant.avatarUrl ? (
                <img src={applicant.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                applicant.name.charAt(0).toUpperCase()
              )}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-heading text-sm font-bold text-foreground">
                {applicant.name}
                <VerifiedBadge isVerified={applicant.isVerifiedPro} size={13} showTooltip={false} />
              </span>
              <span className="block font-body text-xs text-muted-foreground">
                f/{applicant.username} · {applicant.reputation} rep
              </span>
            </span>
          </Link>
        ) : (
          <div className="min-w-0">
            <p className="font-body text-xs text-muted-foreground">Applied {formatTimeAgo(app.createdAt)}</p>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2.5">
          {mode === "received" && (
            <span className="font-body text-xs text-muted-foreground">{formatTimeAgo(app.createdAt)}</span>
          )}
          <StatusBadge status={app.status} />
        </div>
      </div>

      {app.lead && (
        <p className="mt-3 font-body text-sm text-muted-foreground">
          for{" "}
          <Link href={`/l/${app.lead.id}`} className="font-semibold text-foreground hover:text-brand">
            {app.lead.title}
          </Link>{" "}
          <span className="font-mono text-xs text-success">
            {app.lead.budget} {app.lead.currency}
          </span>
        </p>
      )}

      <p className="mt-3 whitespace-pre-wrap font-body text-sm leading-relaxed text-foreground/90">
        {app.proposal}
      </p>

      {mode === "received" && app.status === "pending" && (
        <div className="mt-4 flex gap-2 border-t border-border/60 pt-4">
          <button
            onClick={() => onStatus("accepted")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-radius-md bg-success px-4 py-2 font-body text-sm font-semibold text-success-foreground transition-opacity hover:bg-success/90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" /> Accept
          </button>
          <button
            onClick={() => onStatus("rejected")}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-radius-md border border-border px-4 py-2 font-body text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Reject
          </button>
        </div>
      )}

      {mode === "sent" && app.status === "pending" && (
        <div className="mt-4 border-t border-border/60 pt-4">
          <button
            onClick={() => onStatus("withdrawn")}
            disabled={busy}
            className="font-body text-sm font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
          >
            Withdraw application
          </button>
        </div>
      )}
    </article>
  );
}

export default Applications;
