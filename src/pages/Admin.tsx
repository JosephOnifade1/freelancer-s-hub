import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { QueryErrorState } from "@/components/QueryErrorState";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile } from "@/lib/users";
import {
  fetchModerationUsers,
  fetchReports,
  moderateReport,
  setUserRole,
  setUserVerifiedPro,
  VERIFIED_PRO_ELIGIBLE_REPUTATION,
  type Report,
  type ReportStatus,
  type UserRole,
} from "@/lib/reports";
import { formatTimeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { BadgeCheck, Flag, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type AdminTab = "reports" | "verified" | "roles";

const ENTITY_LINKS: Record<Report["entityType"], (id: string) => string> = {
  post: (id) => `/p/${id}`,
  comment: (id) => `/p/${id}`,
  lead: (id) => `/l/${id}`,
  profile: (id) => `/f/${id}`,
};

const Admin = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>("reports");
  const [statusFilter, setStatusFilter] = useState<ReportStatus>("open");

  const { data: myProfile, isLoading: loadingProfile, isError: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => (user?.uid ? getUserProfile(user.uid) : null),
    enabled: !!user?.uid,
  });

  const role = myProfile?.role || "member";
  const isModerator = role === "admin" || role === "moderator";
  const isAdmin = role === "admin";

  if (loadingProfile) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (profileError) return <AppLayout><div className="mx-auto max-w-xl px-4 py-16"><QueryErrorState title="Couldn't check moderator access" onRetry={() => refetchProfile()} /></div></AppLayout>;

  if (!isModerator) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-2xl px-4 py-16">
          <EmptyState
            icon={ShieldCheck}
            title="Moderators only"
            description="This area is for Borynx moderators and admins. If you were recently given a role, try reloading — roles are read from your profile."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <PageHeader
          title="Moderation"
          subtitle={`Signed in as ${role}. Review reports, manage Verified Pro, and ${isAdmin ? "assign roles." : "view roles (admin only to change)."}`}
        />

        <div className="flex gap-2">
          {(
            [
              { id: "reports", label: "Reports" },
              { id: "verified", label: "Verified Pro" },
              { id: "roles", label: "Roles" },
            ] as { id: AdminTab; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-lg px-4 py-2 font-body text-sm font-medium transition-colors",
                tab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "reports" && (
            <ReportsQueue status={statusFilter} onStatusChange={setStatusFilter} />
          )}
          {tab === "verified" && <VerifiedProManager isAdmin={isAdmin} />}
          {tab === "roles" && <RolesManager isAdmin={isAdmin} currentUid={user?.uid} />}
        </div>
      </div>
    </AppLayout>
  );
};

/* ── Reports queue ─────────────────────────────────────────────────────── */

function ReportsQueue({
  status,
  onStatusChange,
}: {
  status: ReportStatus;
  onStatusChange: (s: ReportStatus) => void;
}) {
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["reports", status],
    queryFn: () => fetchReports(status),
  });

  const mutation = useMutation({
    mutationFn: (vars: { id: string; status: ReportStatus; remove: boolean }) =>
      moderateReport(vars.id, vars.status, vars.remove),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      toast.success(
        vars.remove
          ? "Report resolved and the content was removed."
          : vars.status === "dismissed"
            ? "Report dismissed."
            : "Report resolved."
      );
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Moderation failed."),
  });

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["open", "resolved", "dismissed"] as ReportStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange(s)}
            className={cn(
              "rounded-full px-3.5 py-1.5 font-body text-xs font-semibold capitalize transition-colors",
              status === s ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {isError ? <QueryErrorState title="Couldn't load reports" onRetry={() => refetch()} /> : isLoading ? (
        <div className="flex h-[30vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Flag}
          title={`No ${status} reports`}
          description={
            status === "open"
              ? "The queue is clear. New reports from posts and leads will appear here."
              : `Reports you mark ${status} will be listed here.`
          }
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <article key={report.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 font-body text-[11px] font-semibold capitalize text-destructive">
                  {report.reason}
                </span>
                <span className="font-body text-xs capitalize text-muted-foreground">
                  {report.entityType} report
                </span>
                <span className="ml-auto font-body text-xs text-muted-foreground">
                  {formatTimeAgo(report.createdAt)}
                </span>
              </div>

              <p className="mt-2.5 font-body text-sm text-foreground">
                Reported by{" "}
                {report.reporter ? (
                  <Link to={`/f/${report.reporter.username || report.reporter.uid}`} className="font-semibold hover:text-brand">
                    {report.reporter.name}
                  </Link>
                ) : (
                  "a member"
                )}{" "}
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

              {report.status === "open" && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                  <button
                    onClick={() => { if (window.confirm("Remove the reported content and resolve this report?")) mutation.mutate({ id: report.id, status: "resolved", remove: true }); }}
                    disabled={mutation.isPending}
                    className="rounded-lg bg-destructive px-4 py-2 font-body text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Remove content & resolve
                  </button>
                  <button
                    onClick={() => mutation.mutate({ id: report.id, status: "resolved", remove: false })}
                    disabled={mutation.isPending}
                    className="rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Resolve (keep content)
                  </button>
                  <button
                    onClick={() => mutation.mutate({ id: report.id, status: "dismissed", remove: false })}
                    disabled={mutation.isPending}
                    className="rounded-lg border border-border px-4 py-2 font-body text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Verified Pro ──────────────────────────────────────────────────────── */

function VerifiedProManager({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["moderationUsers"],
    queryFn: () => fetchModerationUsers(50),
  });

  const mutation = useMutation({
    mutationFn: (vars: { uid: string; verified: boolean }) =>
      setUserVerifiedPro(vars.uid, vars.verified),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["moderationUsers"] });
      toast.success(vars.verified ? "Verified Pro granted." : "Verified Pro removed.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update Verified Pro."),
  });

  if (isError) return <QueryErrorState title="Couldn't load moderation users" onRetry={() => refetch()} />;

  if (isLoading) {
    return (
      <div className="flex h-[30vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 max-w-2xl font-body text-sm leading-relaxed text-muted-foreground">
        Verified Pro is earned, not bought: members become eligible at{" "}
        <span className="font-semibold text-foreground">
          {VERIFIED_PRO_ELIGIBLE_REPUTATION.toLocaleString()} reputation
        </span>{" "}
        (Trusted Voice) and an admin confirms the quality of their contributions.
        {isAdmin ? "" : " Only admins can grant or revoke the badge."}
      </p>
      <UserRows
        users={users}
        action={(u) =>
          isAdmin ? (
            <button
              onClick={() => mutation.mutate({ uid: u.uid, verified: !u.isVerifiedPro })}
              disabled={mutation.isPending}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-body text-xs font-semibold transition-opacity disabled:opacity-50",
                u.isVerifiedPro
                  ? "border border-border text-foreground hover:bg-muted"
                  : "bg-brand text-brand-foreground hover:opacity-90"
              )}
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              {u.isVerifiedPro ? "Revoke" : "Grant"}
            </button>
          ) : null
        }
      />
    </div>
  );
}

/* ── Roles ─────────────────────────────────────────────────────────────── */

function RolesManager({ isAdmin, currentUid }: { isAdmin: boolean; currentUid?: string }) {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["moderationUsers"],
    queryFn: () => fetchModerationUsers(50),
  });

  const mutation = useMutation({
    mutationFn: (vars: { uid: string; role: UserRole }) => setUserRole(vars.uid, vars.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderationUsers"] });
      toast.success("Role updated.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to update role."),
  });

  if (isError) return <QueryErrorState title="Couldn't load moderation users" onRetry={() => refetch()} />;

  if (isLoading) {
    return (
      <div className="flex h-[30vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <UserRows
      users={users}
      action={(u) =>
        isAdmin ? (
          <select
            value={u.role}
            disabled={mutation.isPending || u.uid === currentUid}
            onChange={(e) => mutation.mutate({ uid: u.uid, role: e.target.value as UserRole })}
            className="rounded-lg border border-border bg-background px-2.5 py-1.5 font-body text-xs font-medium text-foreground disabled:opacity-50"
            aria-label={`Role for ${u.name}`}
          >
            <option value="member">Member</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        ) : (
          <span className="font-body text-xs capitalize text-muted-foreground">{u.role}</span>
        )
      }
    />
  );
}

/* ── Shared user list ──────────────────────────────────────────────────── */

function UserRows({
  users,
  action,
}: {
  users: Awaited<ReturnType<typeof fetchModerationUsers>>;
  action: (u: Awaited<ReturnType<typeof fetchModerationUsers>>[number]) => React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {users.map((u, i) => {
        const eligible = u.reputation >= VERIFIED_PRO_ELIGIBLE_REPUTATION;
        return (
          <div
            key={u.uid}
            className={cn(
              "flex items-center gap-3 px-5 py-3.5",
              i < users.length - 1 && "border-b border-border/60"
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-heading text-xs font-bold text-foreground">
              {u.avatarUrl ? (
                <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                u.name.charAt(0).toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-body text-sm font-semibold text-foreground">
                <Link to={`/f/${u.username || u.uid}`} className="truncate hover:text-brand">
                  {u.name}
                </Link>
                <VerifiedBadge isVerified={u.isVerifiedPro} size={13} showTooltip={false} />
                {eligible && !u.isVerifiedPro && (
                  <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 font-body text-[10px] font-semibold text-success">
                    Eligible
                  </span>
                )}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                f/{u.username} · {u.reputation.toLocaleString()} rep · {u.role}
              </p>
            </div>
            {action(u)}
          </div>
        );
      })}
    </div>
  );
}

export default Admin;
