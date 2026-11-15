import {sql} from "drizzle-orm";
import {RESET_TABLES} from "./plan";
import type {ContentTransactionDatabase,ContentDatabase} from "../../src/server/features/content/content-queries";
type Relation={oid:number;name:string};
function rows<T>(r:unknown):T[]{return (r as {rows:T[]}).rows;}
const qualified=(name:string)=>sql`${sql.identifier("public")}.${sql.identifier(name)}`;
/** Inspection is not permission to delete: the executor resolves/rechecks under locks. */
export async function inspectResetRelations(db:ContentDatabase){
 const names=sql`ARRAY[${sql.join(RESET_TABLES.map(t=>sql`${t}`),sql`, `)}]::text[]`;
 const relations=rows<Relation>(await db.execute(sql`select c.oid::int as oid,c.relname as name from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(${names}) and c.relkind='r'`));
 if(relations.length!==RESET_TABLES.length||RESET_TABLES.some(t=>!relations.some(r=>r.name===t)))throw Error("reset_missing_or_nonordinary_relation");
 return relations;
}
/** Internal executor; the CLI MUST first apply target/identity/consent gates.
 * No network/pool creation here; tests use only an ephemeral in-memory engine. */
export async function executeDevelopmentReset(db:ContentTransactionDatabase){
 return db.transaction(async tx=>{
  await tx.execute(sql`set local search_path=pg_catalog`);
  await tx.execute(sql`set local lock_timeout='5s'`);await tx.execute(sql`set local statement_timeout='60s'`);
  const before=await inspectResetRelations(tx);
  // Freeze the exact parent relations against concurrent ALTER/FK changes until commit.
  await tx.execute(sql`lock table ${sql.join(RESET_TABLES.map(qualified),sql`, `)} in access exclusive mode`);
  const after=await inspectResetRelations(tx);
  if(before.some(r=>!after.some(a=>a.oid===r.oid&&a.name===r.name)))throw Error("reset_relation_changed");
  const ids=sql`ARRAY[${sql.join(after.map(r=>sql`${r.oid}`),sql`, `)}]::oid[]`;
  const foreign=rows(await tx.execute(sql`select conrelid from pg_catalog.pg_constraint where contype='f' and confrelid=any(${ids}) and not conrelid=any(${ids})`));
  if(foreign.length)throw Error("unexpected_foreign_key_dependents");
  // Inheritance/partitioning, user triggers and rewrite rules can expand effects
  // beyond FK relationships. Fail closed rather than infer safe side effects.
  const expanded=rows(await tx.execute(sql`select inhrelid from pg_catalog.pg_inherits where inhrelid=any(${ids}) or inhparent=any(${ids})`));
  const triggers=rows(await tx.execute(sql`select oid from pg_catalog.pg_trigger where tgrelid=any(${ids}) and not tgisinternal`));
  const rules=rows(await tx.execute(sql`select oid from pg_catalog.pg_rewrite where ev_class=any(${ids})`));
  if(expanded.length||triggers.length||rules.length)throw Error("unexpected_reset_side_effects");
  for(const table of RESET_TABLES)await tx.execute(sql`delete from only ${qualified(table)}`);
  await tx.execute(sql`alter table public.profiles validate constraint profiles_uid_auth_users_id_fk`);
  await tx.execute(sql`alter table public.post_attachments validate constraint attachment_canonical_key`);
 });
}
