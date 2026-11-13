/**
 * Drizzle schema barrel (Phase 2B.2, extended in 2D).
 *
 * One export surface so `drizzle(db, { schema })` and the relational query API
 * see every table. Add each new domain here when it is created — an omission
 * does not fail the build, it only makes relational queries fail at runtime,
 * which is why this file is the single obvious place to look.
 *
 * Domains:
 *   - `identity`  — profiles, usernames        (Phase 2B.2)
 *   - `content`   — posts, comments, votes, polls, poll options, poll votes,
 *                   post attachments, saved posts   (Phase 2D)
 *
 * Still in Supabase and deliberately absent: communities, community members,
 * follows, leads, lead applications, notifications, reports.
 */
export * from "./identity";
export * from "./content";
