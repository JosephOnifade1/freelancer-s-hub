import {describe,it,expect} from "vitest";
import {sql} from "drizzle-orm";
import {securityFixture} from "./security-fixture";
import {executeDevelopmentReset,inspectResetRelations} from "../../scripts/development/reset";
async function resetFixture(){const fixture=await securityFixture();await fixture.engine.exec("insert into auth_users(name,email) values('Sentinel','sentinel@fixture.test')");return fixture;}
describe("actual reset executor SQL: ephemeral PGlite only, no local/hosted server",()=>{
 it("deletes only intended public tables and preserves definitions/history",async()=>{
  const {engine,db}=await resetFixture();try{await engine.exec("create schema drizzle;create table drizzle.__drizzle_migrations(id int);insert into drizzle.__drizzle_migrations values(1)");await executeDevelopmentReset(db);expect((await engine.query("select * from public.auth_users")).rows).toHaveLength(0);expect((await engine.query("select * from drizzle.__drizzle_migrations")).rows).toHaveLength(1);expect((await inspectResetRelations(db)).length).toBe(27);}finally{await engine.close();}
 });
 it.each([
  ["unexpected schema reference","create schema extra;create table extra.unexpected(id uuid references public.auth_users(id))"],
  ["same-name foreign relation","create schema extra;create table extra.profiles(id uuid references public.auth_users(id))"],
  ["cross-schema cascading FK","create schema extra;create table extra.profiles(id uuid references public.auth_users(id) on delete cascade);insert into extra.profiles select id from public.auth_users"],
  ["unexpected qualified dependency","create schema other;create table other.auth_sessions(id uuid references public.auth_users(id) on delete cascade)"],
 ])("refuses %s before ANY deletes",async(_name,ddl)=>{
  const {engine,db}=await resetFixture();try{await engine.exec(ddl);await expect(executeDevelopmentReset(db)).rejects.toThrow("unexpected_foreign_key_dependents");expect((await engine.query("select * from public.auth_users")).rows).toHaveLength(1);}finally{await engine.close();}
 });
 it("re-resolves after planning and rejects newly added dependency",async()=>{
  const {engine,db}=await resetFixture();try{await inspectResetRelations(db);await engine.exec("create table public.new_dependency(id uuid references public.auth_users(id))");await expect(executeDevelopmentReset(db)).rejects.toThrow();expect((await engine.query("select * from public.auth_users")).rows).toHaveLength(1);}finally{await engine.close();}
 });
 it("malicious search_path cannot redirect deletes",async()=>{
  const {engine,db}=await resetFixture();try{await engine.exec("create schema evil;create table evil.auth_users(id int);insert into evil.auth_users values(1);set search_path=evil,public");await executeDevelopmentReset(db);expect((await engine.query("select * from evil.auth_users")).rows).toHaveLength(1);expect((await engine.query("select * from public.auth_users")).rows).toHaveLength(0);}finally{await engine.close();}
 });
 it("missing expected relation refuses before deletes",async()=>{
  const {engine,db}=await resetFixture();try{await engine.exec("drop table public.development_seed_identities");await expect(executeDevelopmentReset(db)).rejects.toThrow("reset_missing_or_nonordinary_relation");expect((await engine.query("select * from public.auth_users")).rows).toHaveLength(1);}finally{await engine.close();}
 });
 it("refuses user DELETE triggers that could expand scope",async()=>{
  const {engine,db}=await resetFixture();try{await engine.exec("create function public.unexpected_effect() returns trigger language plpgsql as $$ begin return old; end $$; create trigger unexpected before delete on public.auth_users for each row execute function public.unexpected_effect()");await expect(executeDevelopmentReset(db)).rejects.toThrow("unexpected_reset_side_effects");expect((await engine.query("select * from public.auth_users")).rows).toHaveLength(1);}finally{await engine.close();}
 });
});
