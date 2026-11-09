import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/auth-context";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationLink,
  type AppNotification,
} from "@/lib/notifications";
import { formatTimeAgo } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Header notification bell: unread badge + latest notifications dropdown.
 * Polls every 30s (v1 has no realtime subscription); clicking an item marks
 * it read and navigates to the thing it describes.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uid = user?.uid;

  const { data: unread = 0, isError: countError, refetch: refetchCount } = useQuery({
    queryKey: ["unreadNotifications", uid],
    queryFn: () => (uid ? fetchUnreadNotificationCount(uid) : 0),
    enabled: !!uid,
    refetchInterval: 30_000,
  });

  const { data: notifications = [], isLoading, isError: notificationsError, refetch: refetchNotifications } = useQuery({
    queryKey: ["notifications", uid],
    queryFn: () => (uid ? fetchNotifications(uid, 10) : []),
    enabled: !!uid,
    refetchInterval: 30_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", uid] });
    queryClient.invalidateQueries({ queryKey: ["unreadNotifications", uid] });
  };

  const readMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message || "Couldn't mark notification as read"),
  });

  const readAllMutation = useMutation({
    mutationFn: () => (uid ? markAllNotificationsRead(uid) : Promise.resolve()),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message || "Couldn't mark notifications as read"),
  });

  if (!user) return null;

  const handleOpen = (n: AppNotification) => {
    if (!n.isRead) readMutation.mutate(n.id);
    navigate(notificationLink(n));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={countError ? "Notifications, unread count unavailable" : unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {countError ? (
            <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-warning" />
          ) : unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] font-bold text-brand-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-heading text-sm font-bold text-foreground">Notifications</p>
          {!countError && unread > 0 && (
            <button
              onClick={() => readAllMutation.mutate()}
              disabled={readAllMutation.isPending}
              className="inline-flex items-center gap-1 font-body text-xs font-medium text-brand hover:underline disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {countError && (
            <div role="alert" className="border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
              Unread count unavailable. <button type="button" onClick={() => void refetchCount()} className="font-semibold text-brand hover:underline">Try again</button>
            </div>
          )}
          {notificationsError ? (
            <div role="alert" className="px-4 py-8 text-center font-body text-sm text-muted-foreground">
              <p>Couldn't load notifications.</p>
              <button type="button" onClick={() => void refetchNotifications()} className="mt-2 font-semibold text-brand hover:underline">Try again</button>
            </div>
          ) : isLoading ? (
            <div role="status" className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading notifications…
            </div>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-10 text-center font-body text-sm text-muted-foreground">
              Nothing yet. Replies, upvotes, follows, and application updates will land here.
            </p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleOpen(n)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  !n.isRead && "bg-brand/[0.04]"
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-heading text-[11px] font-bold text-foreground">
                  {n.actor?.avatarUrl ? (
                    <img src={n.actor.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (n.actor?.name || "?").charAt(0).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[13px] leading-snug text-foreground">
                    {n.message}
                  </span>
                  <span className="mt-0.5 block font-body text-[11px] text-muted-foreground">
                    {formatTimeAgo(n.createdAt)}
                  </span>
                </span>
                {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
              </button>
            ))
          )}
        </div>

        <div className="border-t border-border px-4 py-2.5 text-center">
          <Link to="/notifications" className="font-body text-xs font-semibold text-brand hover:underline">
            View all notifications
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
