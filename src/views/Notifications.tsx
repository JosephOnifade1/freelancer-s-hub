
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { QueryErrorState } from "@/components/QueryErrorState";
import { useAuth } from "@/hooks/auth-context";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationLink,
  type AppNotification,
} from "@/lib/notifications";
import { formatTimeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Notifications = () => {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const uid = user?.uid;

  const { data: notifications = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications", uid],
    queryFn: () => (uid ? fetchNotifications(uid, 50) : []),
    enabled: !!uid,
    refetchInterval: 30_000,
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", uid] });
    queryClient.invalidateQueries({ queryKey: ["unreadNotifications", uid] });
  };

  const readMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to mark as read."),
  });

  const readAllMutation = useMutation({
    mutationFn: () => (uid ? markAllNotificationsRead(uid) : Promise.resolve()),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to mark all as read."),
  });

  const handleOpen = (n: AppNotification) => {
    if (!n.isRead) readMutation.mutate(n.id);
    router.push(notificationLink(n));
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <PageHeader
            title="Notifications"
            subtitle="Replies, upvotes, follows, and updates on your lead applications."
          />
          {unread > 0 && (
            <button
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
              className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-radius-md border border-border px-3.5 py-2 font-body text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <CheckCheck className="h-4 w-4" /> Mark all read
            </button>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
          {isError ? <QueryErrorState title="Couldn't load notifications" onRetry={() => refetch()} /> : isLoading ? (
            <div className="flex h-[40vh] items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Bell}
                title="No notifications yet"
                description="When someone replies to you, upvotes your work, follows you, or acts on an application, it'll show up here."
                action={<button className="rounded-radius-md bg-primary px-4 py-2 font-body text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">Browse posts</button>}
              />
            </div>
          ) : (
            notifications.map((n, i) => (
              <button
                key={n.id}
                onClick={() => handleOpen(n)}
                className={cn(
                  "flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50",
                  i < notifications.length - 1 && "border-b border-border/60",
                  !n.isRead && "bg-brand/[0.03]"
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-heading text-[11px] font-bold text-foreground">
                  {n.actor?.avatarUrl ? (
                    <img src={n.actor.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (n.actor?.name || "?").charAt(0).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-sm leading-snug text-foreground">{n.message}</span>
                  <span className="mt-0.5 block font-body text-[10px] font-mono text-muted-foreground">
                    {n.type.replace(/_/g, " ")} · {formatTimeAgo(n.createdAt)}
                  </span>
                </span>
                {!n.isRead && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
              </button>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Notifications;
