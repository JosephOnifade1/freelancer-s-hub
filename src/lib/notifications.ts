import { supabase } from "./supabase";
import { fetchPublicProfiles, isProfileError } from "./profile-client";

/**
 * In-app notifications (v1).
 *
 * Rows are created by database triggers (see
 * supabase_notifications_migration.sql) — never by client code — so a
 * notification always corresponds to a real comment, reply, upvote,
 * follow, or lead-application event. Clients can only read their own
 * notifications and mark them read; the API here mirrors exactly that.
 */

export type NotificationType =
  | "comment"
  | "reply"
  | "upvote"
  | "follow"
  | "application_received"
  | "application_accepted"
  | "application_rejected"
  | "application_withdrawn";

export interface NotificationActor {
  uid: string;
  username?: string;
  name: string;
  avatarUrl?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  actorUid?: string;
  type: NotificationType;
  entityId?: string;
  contextId?: string;
  message: string;
  isRead: boolean;
  createdAt: number;
  actor?: NotificationActor;
}

interface NotificationRow {
  id: string;
  userId: string;
  actorUid: string | null;
  type: NotificationType;
  entityId: string | null;
  contextId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const rowToNotification = (row: NotificationRow): AppNotification => ({
  id: row.id,
  userId: row.userId,
  actorUid: row.actorUid ?? undefined,
  type: row.type,
  entityId: row.entityId ?? undefined,
  contextId: row.contextId ?? undefined,
  message: row.message,
  isRead: row.isRead,
  createdAt: new Date(row.createdAt).getTime(),
});

const enrichActors = async (items: AppNotification[]): Promise<AppNotification[]> => {
  const uids = [...new Set(items.map((n) => n.actorUid).filter(Boolean))] as string[];
  if (uids.length === 0) return items;

  // Phase 2C: one batched Neon read replaces an N+1 loop of Supabase queries (one
  // per distinct actor). On a page of 30 notifications from 30 people that was 30
  // round-trips.
  const result = await fetchPublicProfiles(uids);
  if (isProfileError(result)) {
    // Actors are decoration; a failed lookup must not fail the notification list.
    return items;
  }

  const profiles = result.data.map(
    (profile) =>
      ({
        uid: profile.uid,
        username: profile.username,
        name: profile.displayName || profile.username || "Unknown",
        avatarUrl: profile.avatarUrl,
      }) as NotificationActor,
  );

  const byUid = new Map(profiles.map((p) => [p.uid, p]));
  return items.map((n) => ({ ...n, actor: n.actorUid ? byUid.get(n.actorUid) : undefined }));
};

export const fetchNotifications = async (
  uid: string,
  limit = 30
): Promise<AppNotification[]> => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("userId", uid)
    .order("createdAt", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return enrichActors((data as NotificationRow[]).map(rowToNotification));
};

export const fetchUnreadNotificationCount = async (uid: string): Promise<number> => {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("userId", uid)
    .eq("isRead", false);

  if (error) throw new Error(error.message);
  return count ?? 0;
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from("notifications")
    .update({ isRead: true })
    .eq("id", notificationId);

  if (error) throw new Error(error.message);
};

export const markAllNotificationsRead = async (uid: string): Promise<void> => {
  const { error } = await supabase
    .from("notifications")
    .update({ isRead: true })
    .eq("userId", uid)
    .eq("isRead", false);

  if (error) throw new Error(error.message);
};

/** Where clicking a notification should take the user. */
export const notificationLink = (n: AppNotification): string => {
  switch (n.type) {
    case "comment":
    case "reply":
    case "upvote":
      // contextId is the post (for comments, the entity is the comment and
      // the context is its post; for post upvotes both are the post).
      return n.contextId ? `/p/${n.contextId}` : "/";
    case "follow":
      return n.actor ? `/f/${n.actor.username || n.actor.uid}` : "/";
    case "application_received":
    case "application_withdrawn":
      return "/applications";
    case "application_accepted":
    case "application_rejected":
      // contextId is the lead the user applied to.
      return n.contextId ? `/l/${n.contextId}` : "/applications";
    default:
      return "/";
  }
};
