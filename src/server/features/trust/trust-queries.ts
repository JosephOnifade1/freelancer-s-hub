import { sql, type SQL } from "drizzle-orm";
import type {
  ContentDatabase,
  ContentTransactionDatabase,
} from "../content/content-queries";
import type { AppNotification } from "@/lib/notifications";
import type { Report, ReportContentPreview } from "@/lib/reports";
export class TrustError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const rows = (r: unknown): Record<string, unknown>[] =>
  Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireIdentity(uid: string | null): asserts uid is string {
  if (!uid) throw new TrustError(401, "unauthenticated");
  if (!UUID.test(uid)) throw new TrustError(400, "invalid_identity");
}
function validId(id: string) {
  if (!UUID.test(id)) throw new TrustError(400, "invalid_id");
}
const states = ["open", "resolved", "dismissed"],
  types = ["post", "comment", "lead", "profile"],
  reasons = [
    "spam",
    "harassment",
    "scam",
    "inappropriate",
    "hate_speech",
    "misinformation",
    "copyright",
    "nsfw",
    "other",
  ];
function allowed(v: unknown, values: string[]) {
  if (typeof v !== "string" || !values.includes(v))
    throw new TrustError(400, "invalid_input");
}
export async function requireStaff(db: ContentDatabase, uid: string | null) {
  requireIdentity(uid);
  const role = rows(
    await db.execute(sql`select role from profiles where uid=${uid}`),
  )[0]?.role;
  if (role !== "admin" && role !== "moderator")
    throw new TrustError(403, "forbidden");
}
/** Current DB facts, not a stale/client-supplied membership snapshot. Alias p is fixed. */
function visiblePost(uid: string): SQL {
  return sql`(p.visibility='public' or p."authorUid"=${uid} or exists(select 1 from profiles staff where staff.uid=${uid} and staff.role in ('admin','moderator')) or (p.visibility='members' and exists(select 1 from community_members m where m."userId"=${uid} and m."communityId"=p."communityId")) or (p.visibility='admins' and exists(select 1 from communities co where co.id=p."communityId" and co."ownerId"=${uid})))`;
}
export async function listNotifications(
  db: ContentDatabase,
  uid: string | null,
  limit = 30,
): Promise<AppNotification[]> {
  requireIdentity(uid);
  const cap = Number.isFinite(limit)
    ? Math.max(1, Math.min(100, Math.trunc(limit)))
    : 30;
  const result = rows(
    await db.execute(sql`select n.*,case when n.type in ('comment','reply','upvote') and not exists(select 1 from posts p where p.id=n."contextId" and p."isDeleted"=false and ${visiblePost(uid)}) then 'This content is no longer available.' else n.message end as "safeMessage",
 case when a.uid is null then null else jsonb_build_object('uid',a.uid,'username',a.username,'name',coalesce(nullif(a."displayName",''),a.username,'Unknown'),'avatarUrl',a."avatarUrl") end as actor
 from notifications n left join profiles a on a.uid=n."actorUid" where n."userId"=${uid} order by n."createdAt" desc,n.id desc limit ${cap}`),
  );
  return result.map((r) => ({
    id: String(r.id),
    userId: String(r.userId),
    actorUid: r.actorUid ? String(r.actorUid) : undefined,
    type: r.type as AppNotification["type"],
    entityId: r.entityId ? String(r.entityId) : undefined,
    contextId: r.contextId ? String(r.contextId) : undefined,
    message: String(r.safeMessage),
    isRead: Boolean(r.isRead),
    createdAt: new Date(r.createdAt as string).getTime(),
    actor: r.actor as AppNotification["actor"],
  }));
}
export async function unreadCount(db: ContentDatabase, uid: string | null) {
  requireIdentity(uid);
  return Number(
    rows(
      await db.execute(
        sql`select count(*)::int as n from notifications where "userId"=${uid} and "isRead"=false`,
      ),
    )[0].n,
  );
}
export async function markRead(
  db: ContentDatabase,
  uid: string | null,
  id?: string,
) {
  requireIdentity(uid);
  if (id !== undefined) validId(id);
  const changed = rows(
    await db.execute(
      sql`update notifications set "isRead"=true where "userId"=${uid} and ${id ? sql`id=${id}` : sql`"isRead"=false`} returning id`,
    ),
  );
  if (id && !changed.length) throw new TrustError(404, "not_found");
}
const reporter = sql`jsonb_build_object('uid',p.uid,'username',p.username,'name',coalesce(nullif(p."displayName",''),p.username,'Unknown'))`;
function report(r: Record<string, unknown>): Report {
  return {
    id: String(r.id),
    reporterUid: String(r.reporterUid),
    entityType: r.entityType as Report["entityType"],
    entityId: String(r.entityId),
    reason: r.reason as Report["reason"],
    details: String(r.details),
    status: r.status as Report["status"],
    resolvedBy: r.resolvedBy ? String(r.resolvedBy) : undefined,
    createdAt: new Date(r.createdAt as string).getTime(),
    updatedAt: new Date(r.updatedAt as string).getTime(),
    reporter: r.reporter as Report["reporter"],
  };
}
export async function recentReportCount(
  db: ContentDatabase,
  uid: string | null,
) {
  requireIdentity(uid);
  return Number(
    rows(
      await db.execute(
        sql`select count(*)::int as n from reports where "reporterUid"=${uid} and "createdAt">=now()-interval '24 hours'`,
      ),
    )[0].n,
  );
}
export async function createReport(
  db: ContentTransactionDatabase,
  uid: string | null,
  input: {
    entityType: string;
    entityId: string;
    reason: string;
    details?: string;
  },
) {
  requireIdentity(uid);
  validId(input.entityId);
  allowed(input.entityType, types);
  allowed(input.reason, reasons);
  if (
    input.details !== undefined &&
    (typeof input.details !== "string" || input.details.length > 10000)
  )
    throw new TrustError(400, "invalid_details");
  return db.transaction(async (tx) => {
    // Serialize the rolling quota for one reporter; duplicate reports are allowed,
    // matching the original schema, but concurrent requests cannot bypass 10/day.
    if (
      !rows(
        await tx.execute(
          sql`select uid from profiles where uid=${uid} for update`,
        ),
      ).length
    )
      throw new TrustError(403, "profile_missing");
    if ((await recentReportCount(tx, uid)) >= 10)
      throw new TrustError(429, "report_limit");
    let target: SQL;
    switch (input.entityType) {
      case "post":
        target = sql`select p.id from posts p where p.id=${input.entityId} and p."isDeleted"=false and ${visiblePost(uid)}`;
        break;
      case "comment":
        target = sql`select c.id from comments c join posts p on p.id=c."postId" where c.id=${input.entityId} and c."isDeleted"=false and p."isDeleted"=false and ${visiblePost(uid)}`;
        break;
      case "lead":
        target = sql`select id from leads where id=${input.entityId}`;
        break;
      default:
        target = sql`select uid from profiles where uid=${input.entityId}`;
    }
    if (!rows(await tx.execute(target)).length)
      throw new TrustError(404, "not_found");
    return String(
      rows(
        await tx.execute(
          sql`insert into reports ("reporterUid","entityType","entityId",reason,details) values (${uid},${input.entityType},${input.entityId},${input.reason},${input.details?.trim() ?? ""}) returning id`,
        ),
      )[0].id,
    );
  });
}
export async function listReports(
  db: ContentDatabase,
  uid: string | null,
  own = false,
  status?: string,
  beforeId?: string,
) {
  requireIdentity(uid);
  if (beforeId) validId(beforeId);
  if (status) allowed(status, states);
  if (!own) await requireStaff(db, uid);
  return rows(
    await db.execute(
      sql`select r.*,${reporter} as reporter from reports r left join profiles p on p.uid=r."reporterUid" where ${own ? sql`r."reporterUid"=${uid}` : sql`true`} ${status ? sql`and r.status=${status}` : sql``} ${beforeId ? sql`and (r."createdAt",r.id)<(select cursor."createdAt",cursor.id from reports cursor where cursor.id=${beforeId} and ${own ? sql`cursor."reporterUid"=${uid}` : sql`true`})` : sql``} order by r."createdAt" desc,r.id desc limit 100`,
    ),
  ).map(report);
}
export async function openReportCount(db: ContentDatabase, uid: string | null) {
  await requireStaff(db, uid);
  return Number(
    rows(
      await db.execute(
        sql`select count(*)::int as n from reports where status='open'`,
      ),
    )[0].n,
  );
}
export async function moderateReport(
  db: ContentTransactionDatabase,
  uid: string | null,
  id: string,
  status: string,
  remove = false,
) {
  requireIdentity(uid);
  validId(id);
  allowed(status, states);
  if (typeof remove !== "boolean" || (remove && status !== "resolved"))
    throw new TrustError(400, "invalid_action");
  return db.transaction(async (tx) => {
    await requireStaff(tx, uid);
    const r = rows(
      await tx.execute(sql`select * from reports where id=${id} for update`),
    )[0];
    if (!r) throw new TrustError(404, "not_found");
    if (remove) {
      switch (r.entityType) {
        case "post":
          await tx.execute(
            sql`update posts set "isDeleted"=true,"updatedAt"=now() where id=${r.entityId} and "isDeleted"=false`,
          );
          break;
        case "comment": {
          // Lock order matches createComment/softDeleteComment: parent post first.
          const c = rows(
            await tx.execute(
              sql`select "postId" from comments where id=${r.entityId}`,
            ),
          )[0];
          if (c) {
            await tx.execute(
              sql`select id from posts where id=${c.postId} for update`,
            );
            const changed = rows(
              await tx.execute(
                sql`update comments set "isDeleted"=true where id=${r.entityId} and "isDeleted"=false returning id`,
              ),
            );
            if (changed.length)
              await tx.execute(
                sql`update posts set "commentCount"=greatest(0,"commentCount"-1),"updatedAt"=now() where id=${c.postId}`,
              );
          }
          break;
        }
        case "lead":
          await tx.execute(
            sql`update leads set status='closed' where id=${r.entityId}`,
          );
          break;
        // Profile reports never automatically delete/suspend an account.
      }
    }
    if (r.status !== status)
      await tx.execute(
        sql`update reports set status=${status},"resolvedBy"=${status === "open" ? null : uid},"updatedAt"=now() where id=${id}`,
      );
  });
}
/** Staff only; actual stored report targets, typed keys prevent UUID/type collisions. */
export async function reportPreviews(
  db: ContentDatabase,
  uid: string | null,
  ids: string[],
): Promise<(ReportContentPreview & { entityType: string })[]> {
  await requireStaff(db, uid);
  if (!Array.isArray(ids) || ids.length > 100)
    throw new TrustError(400, "invalid_ids");
  ids.forEach(validId);
  if (!ids.length) return [];
  const subset = sql`r.id in (${sql.join(
    ids.map((v) => sql`${v}`),
    sql`, `,
  )})`;
  const result = rows(
    await db.execute(sql`
 select distinct r."entityType",r."entityId",p.title,p.body,p."authorUid",p."isDeleted",coalesce(a."displayName",a.username) as "authorName" from reports r join posts p on p.id=r."entityId" left join profiles a on a.uid=p."authorUid" where ${subset} and r."entityType"='post'
 union all select distinct r."entityType",r."entityId",null,c.body,c."authorUid",c."isDeleted",coalesce(a."displayName",a.username) from reports r join comments c on c.id=r."entityId" left join profiles a on a.uid=c."authorUid" where ${subset} and r."entityType"='comment'
 union all select distinct r."entityType",r."entityId",l.title,l.description,l."postedByUid",l.status='closed',coalesce(a."displayName",a.username) from reports r join leads l on l.id=r."entityId" left join profiles a on a.uid=l."postedByUid" where ${subset} and r."entityType"='lead'
 union all select distinct r."entityType",r."entityId",null,a.bio,a.uid,false,coalesce(a."displayName",a.username) from reports r join profiles a on a.uid=r."entityId" where ${subset} and r."entityType"='profile'
 `),
  );
  return result.map((r) => ({
    entityType: String(r.entityType),
    entityId: String(r.entityId),
    title: r.title as string,
    body: r.body as string,
    authorUid: r.authorUid as string,
    authorName: r.authorName as string,
    isDeleted: Boolean(r.isDeleted),
  }));
}
