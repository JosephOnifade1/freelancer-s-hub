/**
 * Drizzle schema barrel (Phase 2B.2).
 *
 * One export surface so `drizzle(db, { schema })` and the relational query API
 * see every table. Add each new domain here when it is created — an omission
 * does not fail the build, it only makes relational queries fail at runtime,
 * which is why this file is the single obvious place to look.
 *
 * Only the identity domain exists. Later phases add their own `schema/*.ts`
 * files and one line each here.
 */
export * from "./identity";
