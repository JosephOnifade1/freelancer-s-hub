import { sql, type SQL } from "drizzle-orm";
import type { ContentDatabase } from "../content/content-queries";
const rows = (r: unknown): Record<string, unknown>[] =>
  Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows;
const name = (uid: string) =>
  sql`coalesce((select coalesce(nullif("displayName",''),username) from profiles where uid=${uid}),'Someone')`;
/** Internal only. Caller supplies the CURRENT domain transaction, never the pool.
 * Stable entity events dedupe forever; genuine recurring transitions include the
 * transaction ID. Retrying an unchanged mutation never calls an event emitter. */
async function emit(
  tx: ContentDatabase,
  recipient: string,
  actor: string,
  type: string,
  entity: string,
  context: string | null,
  message: SQL,
  key: string,
  transition = false,
) {
  if (!recipient || !actor || recipient === actor) return;
  const eventKey = transition
    ? sql`${key} || ':' || txid_current()::text`
    : sql`${key}`;
  await tx.execute(sql`insert into notifications ("userId","actorUid",type,"entityId","contextId",message,"eventKey")
 values (${recipient},${actor},${type},${entity},${context},${message},${eventKey}) on conflict ("eventKey","userId") do nothing`);
}
export async function notifyComment(tx: ContentDatabase, commentId: string) {
  const r = rows(
    await tx.execute(
      sql`select c."authorUid",c."postId",c."parentId",p."authorUid" as "postAuthor",p.title,parent."authorUid" as "parentAuthor" from comments c join posts p on p.id=c."postId" left join comments parent on parent.id=c."parentId" where c.id=${commentId}`,
    ),
  )[0];
  if (!r) throw new Error("Missing notification source");
  const actor = String(r.authorUid),
    post = String(r.postId);
  if (r.parentId)
    await emit(
      tx,
      String(r.parentAuthor),
      actor,
      "reply",
      commentId,
      post,
      sql`${name(actor)} || ' replied to your comment'`,
      `reply:${commentId}`,
    );
  if (!r.parentId || r.postAuthor !== r.parentAuthor)
    await emit(
      tx,
      String(r.postAuthor),
      actor,
      "comment",
      commentId,
      post,
      sql`${name(actor)} || ' commented on your post "' || left(${String(r.title)},60) || '"'`,
      `comment:${commentId}`,
    );
}
export async function notifyUpvote(
  tx: ContentDatabase,
  actor: string,
  type: "post" | "comment",
  entityId: string,
  postId: string,
  recipient: string,
) {
  await emit(
    tx,
    recipient,
    actor,
    "upvote",
    entityId,
    postId,
    sql`${name(actor)} || ' upvoted your ' || ${type}`,
    `upvote:${type}:${entityId}:${actor}`,
    true,
  );
}
export async function notifyFollow(
  tx: ContentDatabase,
  actor: string,
  recipient: string,
) {
  await emit(
    tx,
    recipient,
    actor,
    "follow",
    actor,
    null,
    sql`${name(actor)} || ' started following you'`,
    `follow:${actor}:${recipient}`,
    true,
  );
}
export async function notifyApplication(
  tx: ContentDatabase,
  applicationId: string,
  previous: string | null,
) {
  const a = rows(
    await tx.execute(
      sql`select a.*,l."postedByUid",l.title from lead_applications a join leads l on l.id=a."leadId" where a.id=${applicationId}`,
    ),
  )[0];
  if (!a) throw new Error("Missing notification source");
  const applicant = String(a.applicantUid),
    owner = String(a.postedByUid),
    context = String(a.leadId);
  if (previous === null) {
    await emit(
      tx,
      owner,
      applicant,
      "application_received",
      applicationId,
      context,
      sql`${name(applicant)} || ' applied to your lead "' || left(${String(a.title)},60) || '"'`,
      `application_received:${applicationId}`,
    );
  } else if (a.status !== previous) {
    if (a.status === "accepted" || a.status === "rejected")
      await emit(
        tx,
        applicant,
        owner,
        `application_${a.status}`,
        applicationId,
        context,
        sql`'Your application to "' || left(${String(a.title)},60) || '" was ' || ${String(a.status)}`,
        `application_${a.status}:${applicationId}`,
        true,
      );
    else if (a.status === "withdrawn")
      await emit(
        tx,
        owner,
        applicant,
        "application_withdrawn",
        applicationId,
        context,
        sql`${name(applicant)} || ' withdrew their application to "' || left(${String(a.title)},60) || '"'`,
        `application_withdrawn:${applicationId}`,
        true,
      );
  }
}
