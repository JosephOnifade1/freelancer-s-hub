import "server-only";
import { getServerSession } from "@/lib/server-session";
import { getDatabase, isDatabaseConfigured } from "@/server/db";
import * as q from "./trust-queries";
export async function trustRequest(
  method: string,
  params: URLSearchParams,
  body: Record<string, unknown>,
) {
  if (!isDatabaseConfigured())
    throw new q.TrustError(503, "database_not_configured");
  const uid = (await getServerSession())?.uid ?? null;
  q.requireIdentity(uid);
  const db = getDatabase(),
    op = params.get("op"),
    id = params.get("id") ?? "";
  if (method === "GET")
    switch (op) {
      case "notifications":
        return q.listNotifications(
          db,
          uid,
          params.has("limit") ? Number(params.get("limit")) : 30,
        );
      case "unread":
        return q.unreadCount(db, uid);
      case "recent-reports":
        return q.recentReportCount(db, uid);
      case "reports":
        return q.listReports(
          db,
          uid,
          false,
          params.get("status") ?? undefined,
          ...(params.has("before") ? [params.get("before")] : []),
        );
      case "my-reports":
        return q.listReports(
          db,
          uid,
          true,
          ...(params.has("before") ? [undefined, params.get("before")] : []),
        );
      case "open-reports":
        return q.openReportCount(db, uid);
    }
  if (method === "POST")
    switch (op) {
      case "reports":
        return q.createReport(db, uid, {
          entityType: body.entityType as string,
          entityId: body.entityId as string,
          reason: body.reason as string,
          details: body.details as string | undefined,
        });
      case "previews":
        return q.reportPreviews(db, uid, body.ids as string[]);
    }
  if (method === "PATCH")
    switch (op) {
      case "read":
        await q.markRead(db, uid, id);
        return true;
      case "read-all":
        await q.markRead(db, uid);
        return true;
      case "moderate":
        await q.moderateReport(
          db,
          uid,
          id,
          body.status as string,
          body.remove === undefined ? false : (body.remove as boolean),
        );
        return true;
    }
  throw new q.TrustError(400, "invalid_operation");
}
