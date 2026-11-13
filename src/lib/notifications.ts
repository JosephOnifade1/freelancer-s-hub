import { trustRequest } from "./trust-client";
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

// Legacy uid arguments retained for UI compatibility; authorization is session-only.
export const fetchNotifications = async (
  _uid: string,
  limit = 30,
): Promise<AppNotification[]> =>
  trustRequest("notifications", { limit: String(limit) });
export const fetchUnreadNotificationCount = async (
  _uid: string,
): Promise<number> => trustRequest("unread");
export const markNotificationRead = async (id: string): Promise<void> =>
  trustRequest("read", { id }, "PATCH", {});
export const markAllNotificationsRead = async (_uid: string): Promise<void> =>
  trustRequest("read-all", {}, "PATCH", {});

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
