import "server-only";
import { getServerSession } from "@/lib/server-session";
import { getDatabase, isDatabaseConfigured } from "@/server/db";
import * as q from "./social-queries";

/** Explicit dispatch prevents any request field from replacing the actor/session. */
export async function socialRequest(method: string, params: URLSearchParams, body: Record<string, unknown>) {
  if (!isDatabaseConfigured()) throw new q.SocialError(503, "database_not_configured");
  const db = getDatabase();
  const session = await getServerSession();
  const uid = session?.uid ?? null;
  if (method !== "GET" && !uid) throw new q.SocialError(401, "unauthenticated");
  const op = params.get("op");
  const slug = params.get("slug") ?? "";
  if (method === "GET") {
    switch (op) {
      case "communities": return q.listCommunities(db, slug || undefined);
      case "members": return q.communityMembers(db, slug);
      case "memberships": return q.userCommunities(db, params.get("uid") ?? uid ?? "");
      case "facts":
        if (!uid) throw new q.SocialError(401, "unauthenticated");
        return q.communityFacts(db, uid);
      case "followers": case "following": return q.followList(db, params.get("uid") ?? uid ?? "", op);
    }
  } else if (method === "POST") {
    switch (op) {
      case "communities": {
        const input = { slug: body.slug, name: body.name, description: body.description,
          category: body.category, topics: body.topics, icon: body.icon };
        return q.createCommunity(db, uid, input as q.CommunityInput);
      }
      case "membership":
        if (typeof body.joined !== "boolean") throw new q.SocialError(400, "invalid_input");
        return q.setMembership(db, uid, slug, body.joined);
      case "follow":
        if (body.following !== "toggle" && typeof body.following !== "boolean") throw new q.SocialError(400, "invalid_input");
        if (typeof body.target !== "string") throw new q.SocialError(400, "invalid_input");
        return q.setFollow(db, uid, body.target, body.following);
    }
  } else if (method === "PATCH" && op === "communities") {
    // Explicit whitelist: ownerId, id, memberCount, actorUid are never forwarded.
    const patch: Partial<q.CommunityInput> = {};
    for (const key of ["slug", "name", "description", "category", "topics", "icon"] as const) {
      if (Object.hasOwn(body, key)) Object.assign(patch, { [key]: body[key] });
    }
    return q.updateCommunity(db, uid, slug, patch);
  }
  throw new q.SocialError(400, "invalid_operation");
}
