import { notifyFollow } from "../trust/notification-events";
import { sql } from "drizzle-orm";
import type { ContentDatabase, ContentTransactionDatabase } from "../content/content-queries";

export class SocialError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
export const rows = (r: unknown): Record<string, unknown>[] =>
  Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function actor(uid: string | null): asserts uid is string {
  if (!uid) throw new SocialError(401, "unauthenticated");
  if (!uuid.test(uid)) throw new SocialError(400, "invalid_identity");
}
function clean(input: unknown, max: number): string {
  if (typeof input !== "string" || !input.trim() || input.trim().length > max) throw new SocialError(400, "invalid_input");
  return input.trim();
}
export interface CommunityInput { slug: string; name: string; description: string; topics?: string[]; category?: string; icon?: string | null }
function values(input: CommunityInput) {
  const slug = clean(input.slug, 100).toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new SocialError(400, "invalid_slug");
  const name = clean(input.name, 200), description = clean(input.description, 10000);
  if (input.topics !== undefined && (!Array.isArray(input.topics) || input.topics.length > 20 || input.topics.some(t => typeof t !== "string" || t.length > 100))) throw new SocialError(400, "invalid_topics");
  const category = input.category ?? "Other";
  if (!["Development", "Design", "Business", "Marketing", "Lifestyle", "Other"].includes(category)) throw new SocialError(400, "invalid_category");
  if (input.icon != null && (typeof input.icon !== "string" || input.icon.length > 500)) throw new SocialError(400, "invalid_icon");
  return { slug, name, description, category, topics: input.topics ?? [], icon: input.icon ?? null };
}
const array = (a: string[]) => a.length ? sql`array[${sql.join(a.map(s => sql`${s}`), sql`, `)}]::text[]` : sql`'{}'::text[]`;

/** Communities and member lists were public in the audited product. No private mode is invented. */
export async function listCommunities(db: ContentDatabase, slug?: string) {
  return rows(await db.execute(sql`select * from communities ${slug ? sql`where slug = ${slug}` : sql``} order by "memberCount" desc, slug`));
}
export async function createCommunity(db: ContentTransactionDatabase, uid: string | null, input: CommunityInput): Promise<Record<string, unknown>> {
  actor(uid);
  const v = values(input);
  return db.transaction(async tx => {
    const created = rows(await tx.execute(sql`insert into communities (slug,name,description,category,topics,icon,"ownerId") values (${v.slug},${v.name},${v.description},${v.category},${array(v.topics)},${v.icon},${uid}) on conflict (slug) do nothing returning *`));
    if (!created.length) throw new SocialError(409, "slug_taken");
    await tx.execute(sql`insert into community_members ("userId","communityId") values (${uid},${created[0].id})`);
    await tx.execute(sql`update communities set "memberCount"=1 where id=${created[0].id}`);
    return { ...created[0], memberCount: 1 };
  });
}
export async function updateCommunity(db: ContentTransactionDatabase, uid: string | null, slug: string, patch: Partial<CommunityInput>) {
  actor(uid);
  return db.transaction(async tx => {
    const found = rows(await tx.execute(sql`select * from communities where slug=${slug} for update`));
    if (!found.length) throw new SocialError(404, "not_found");
    const c = found[0];
    const role = rows(await tx.execute(sql`select role from profiles where uid=${uid}`));
    if (c.ownerId !== uid && role[0]?.role !== "admin") throw new SocialError(403, "forbidden");
    const v = values({ ...c, ...patch } as unknown as CommunityInput);
    return rows(await tx.execute(sql`update communities set slug=${v.slug},name=${v.name},description=${v.description},category=${v.category},topics=${array(v.topics)},icon=${v.icon} where id=${c.id} returning *`))[0];
  });
}
export async function setMembership(db: ContentTransactionDatabase, uid: string | null, slug: string, joined: boolean) {
  actor(uid);
  return db.transaction(async tx => {
    const community = rows(await tx.execute(sql`select id from communities where slug=${slug} for update`))[0];
    if (!community) throw new SocialError(404, "not_found");
    const changed = joined
      ? rows(await tx.execute(sql`insert into community_members ("userId","communityId") values (${uid},${community.id}) on conflict do nothing returning "userId"`))
      : rows(await tx.execute(sql`delete from community_members where "userId"=${uid} and "communityId"=${community.id} returning "userId"`));
    if (changed.length) await tx.execute(sql`update communities set "memberCount"="memberCount"+${joined ? 1 : -1} where id=${community.id}`);
    return { joined };
  });
}
export async function userCommunities(db: ContentDatabase, uid: string) {
  if (!uuid.test(uid)) throw new SocialError(400, "invalid_identity");
  return rows(await db.execute(sql`select c.slug from community_members m join communities c on c.id=m."communityId" where m."userId"=${uid} order by c.slug`)).map(r => String(r.slug));
}
/** Public projection, single join, no role or per-profile lookup. */
export async function communityMembers(db: ContentDatabase, slug: string) {
  if (!(await listCommunities(db, slug)).length) throw new SocialError(404, "not_found");
  return rows(await db.execute(sql`select p.uid,p.username,p."displayName",p."avatarUrl",p.reputation,p."isVerifiedPro" from community_members m join communities c on c.id=m."communityId" join profiles p on p.uid=m."userId" where c.slug=${slug} order by p.reputation desc,p.uid`));
}
export async function communityFacts(db: ContentDatabase, uid: string) {
  const [members, owned] = await Promise.all([
    db.execute(sql`select c.id,c.slug from community_members m join communities c on c.id=m."communityId" where m."userId"=${uid}`),
    db.execute(sql`select id,slug from communities where "ownerId"=${uid}`),
  ]);
  return {
    memberSlugs: rows(members).map(r => String(r.slug)), ownedSlugs: rows(owned).map(r => String(r.slug)),
    memberIds: rows(members).map(r => String(r.id)), ownedIds: rows(owned).map(r => String(r.id)),
  };
}

/** Ordered row locks serialize both directions without A->B / B->A deadlocks.
 * No session-level locks; every lock is within the same pg/Drizzle transaction. */
export async function setFollow(db: ContentTransactionDatabase, uid: string | null, target: string, following: boolean | "toggle") {
  actor(uid);
  if (!uuid.test(target)) throw new SocialError(400, "invalid_identity");
  if (target === uid) throw new SocialError(400, "self_follow");
  return db.transaction(async tx => {
    const locked = rows(await tx.execute(sql`select uid from profiles where uid in (${uid},${target}) order by uid for update`));
    if (locked.length !== 2) throw new SocialError(404, "not_found");
    const existing = rows(await tx.execute(sql`select "followerId" from follows where "followerId"=${uid} and "followingId"=${target}`)).length > 0;
    const desired = following === "toggle" ? !existing : following;
    if (existing !== desired) {
      if (desired) await tx.execute(sql`insert into follows ("followerId","followingId") values (${uid},${target})`);
      else await tx.execute(sql`delete from follows where "followerId"=${uid} and "followingId"=${target}`);
      const delta = desired ? 1 : -1;
      await tx.execute(sql`update profiles set following=following+${delta}, "updatedAt"=now() where uid=${uid}`);
      await tx.execute(sql`update profiles set followers=followers+${delta}, "updatedAt"=now() where uid=${target}`);
      if (desired) await notifyFollow(tx, uid, target);
    }
    return { following: desired };
  });
}
export async function followList(db: ContentDatabase, uid: string, direction: "followers" | "following") {
  if (!uuid.test(uid)) throw new SocialError(400, "invalid_identity");
  const match = direction === "followers" ? sql`f."followingId"=${uid}` : sql`f."followerId"=${uid}`;
  const other = direction === "followers" ? sql`f."followerId"` : sql`f."followingId"`;
  return rows(await db.execute(sql`select p.uid,p.username,p."displayName",p."avatarUrl",p.reputation,p."isVerifiedPro" from follows f join profiles p on p.uid=${other} where ${match} order by p.uid`));
}
