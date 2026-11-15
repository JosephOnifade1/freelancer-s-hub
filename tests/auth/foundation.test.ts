import {afterAll,beforeAll,describe,it,expect} from "vitest";
import {PGlite} from "@electric-sql/pglite";
import {drizzle} from "drizzle-orm/pglite";
import {readFileSync,readdirSync} from "node:fs";
import {sql} from "drizzle-orm";
import {guardedAuthHandler} from "../../src/server/auth/handler";
import {PgDialect} from "drizzle-orm/pg-core";
import {createBorynxAuth} from "../../src/server/auth/factory";
import {provisionProfile} from "../../src/server/features/identity/provision-profile";
import {seedDevelopment} from "../../scripts/development/seed";
import {DEMO_ACCOUNTS} from "../../src/server/auth/development";
// Actual Better Auth + Drizzle adapter + embedded PostgreSQL. No provider, pg
// socket, actual .env, fixed user credentials, external email or OAuth calls.
const password=crypto.randomUUID()+"!", secret=crypto.randomUUID()+crypto.randomUUID();
const env={NODE_ENV:"test",BETTER_AUTH_URL:"http://localhost:3000",BETTER_AUTH_SECRET:secret,DATABASE_URL:"postgresql://fixture@127.0.0.1/borynx_test"} as NodeJS.ProcessEnv;
let engine:PGlite,db:ReturnType<typeof drizzle>,auth:ReturnType<typeof createBorynxAuth>;
const mail:{url:string;to:string;purpose:string}[]=[];
const headers={origin:"http://localhost:3000"};
beforeAll(async()=>{
 engine=new PGlite();db=drizzle(engine);
 // Migration execution against an in-memory engine ONLY; no external target.
 for(const name of readdirSync("src/server/db/migrations").filter(n=>/^\d+.*\.sql$/.test(n)).sort())await engine.exec(readFileSync("src/server/db/migrations/"+name,"utf8"));
 auth=createBorynxAuth(db,async message=>{mail.push(message);},env,false);
});
afterAll(async()=>{await engine?.close();});
async function signup(email:string,name="Fixture User"){
 return auth.api.signUpEmail({body:{email,password,name},headers});
}
describe("Better Auth UUID foundation (embedded PostgreSQL, not live Neon)",()=>{
 let uid:string,cookie:string;
 it("creates UUID user/account, requires verification and uses real Drizzle adapter",async()=>{
  const result=await signup("fixture@borynx.test");uid=result.user.id;
  expect(uid).toMatch(/^[0-9a-f-]{36}$/);expect(result.token).toBeNull();
  const types=await engine.query<{data_type:string}>("select data_type from information_schema.columns where table_name='auth_users' and column_name='id'");expect(types.rows[0].data_type).toBe("uuid");
  const account=await engine.query<{user_id:string;password:string}>("select user_id,password from auth_accounts where user_id=$1",[uid]);expect(account.rows[0].user_id).toBe(uid);expect(account.rows[0].password).not.toBe(password);
  const count=mail.length;
  await expect(auth.api.signInEmail({body:{email:"fixture@borynx.test",password},headers})).rejects.toMatchObject({body:{code:"EMAIL_NOT_VERIFIED"}});
  expect(mail).toHaveLength(count); // login never implicitly sends another message

 });
 it("verification token validates; creates and validates a normal session",async()=>{
  const link=mail.find(m=>m.to==="fixture@borynx.test"&&m.purpose==="verification")!;
  const url=new URL(link.url);await auth.api.verifyEmail({query:{token:url.searchParams.get("token")!}});
  const response=await auth.api.signInEmail({body:{email:"fixture@borynx.test",password},headers,asResponse:true});
  expect(response.status).toBe(200);cookie=response.headers.get("set-cookie")!.split(";")[0];
  const session=await auth.api.getSession({headers:new Headers({cookie})});expect(session?.user.id).toBe(uid);
  expect(session?.user.emailVerified).toBe(true);
 });
 it("profile and registry share auth UUID; provisioning idempotent and does not overwrite",async()=>{
  const first=await provisionProfile(db,{uid,displayName:"Fixture User"});expect(first.ok).toBe(true);
  const again=await provisionProfile(db,{uid,displayName:"Do not overwrite"});expect(again).toMatchObject({ok:true,profile:{uid,created:false}});
  const result=await engine.query<{uid:string;displayName:string;role:string}>(`select p.uid,p."displayName",p.role from profiles p join usernames n on n.uid=p.uid where p.uid=$1`,[uid]);expect(result.rows).toHaveLength(1);expect(result.rows[0].displayName).toBe("Fixture User");expect(result.rows[0].role).toBe("member");
 });
 it("concurrent first provisioning, username collision and registry collision are safe",async()=>{
  const a=await signup("collision-a@borynx.test"),b=await signup("collision-b@borynx.test");
  const outcomes=await Promise.all([provisionProfile(db,{uid:a.user.id,displayName:"Same Name"}),provisionProfile(db,{uid:a.user.id,displayName:"Same Name"}),provisionProfile(db,{uid:b.user.id,displayName:"Same Name"})]);expect(outcomes.every(r=>r.ok)).toBe(true);
  const rows=await engine.query<{username:string}>(`select username from profiles where uid=any($1::uuid[])`,[[a.user.id,b.user.id]]);expect(new Set(rows.rows.map(r=>r.username)).size).toBe(2);
 });
 it("rolls both writes back when registry operation fails",async()=>{
  const user=await signup("rollback@borynx.test");
  const broken={execute:db.execute.bind(db),transaction:async(run:Parameters<typeof db.transaction>[0])=>db.transaction(async tx=>run(new Proxy(tx,{get(target,property){if(property==="transaction")return async(nested:(arg:unknown)=>unknown)=>tx.transaction(async savepoint=>nested(new Proxy(savepoint,{get(t,p){if(p==="execute")return async(query:Parameters<typeof tx.execute>[0])=>{const rendered=new PgDialect().sqlToQuery(query as ReturnType<typeof sql>);if(rendered.sql.includes("insert into usernames"))throw Error("fixture injected registry failure");return savepoint.execute(query);};return Reflect.get(t,p,t);}})));return Reflect.get(target,property,target);}})))};
  const result=await provisionProfile(broken as Parameters<typeof provisionProfile>[0],user.user?{uid:user.user.id}:{} as never);expect(result.ok).toBe(false);
  expect((await engine.query("select uid from profiles where uid=$1",[user.user.id])).rows).toHaveLength(0);
 });
 it("invalid client-like UID cannot provision; DB FK rejects nonexistent auth identity",async()=>{
  expect(await provisionProfile(db,{uid:"client-supplied",displayName:"Admin"})).toMatchObject({ok:false,reason:"invalid_identity"});
  expect(await provisionProfile(db,{uid:crypto.randomUUID(),displayName:"Admin"})).toMatchObject({ok:false});
 });
 it("rejects invalid, expired and logged-out sessions",async()=>{
  expect(await auth.api.getSession({headers:new Headers({cookie:"borynx.session_token=invalid"})})).toBeNull();
  await auth.api.signOut({headers:new Headers({cookie,origin:headers.origin})});expect(await auth.api.getSession({headers:new Headers({cookie})})).toBeNull();
  const response=await auth.api.signInEmail({body:{email:"fixture@borynx.test",password},headers,asResponse:true});const expired=response.headers.get("set-cookie")!.split(";")[0];
  await db.execute(sql`update auth_sessions set expires_at=now()-interval '1 day'`);
  expect(await auth.api.getSession({headers:new Headers({cookie:expired})})).toBeNull();
 });
 it("configuration forbids implicit linking and privilege metadata fields",()=>{
  expect(auth.options.account?.accountLinking).toMatchObject({disableImplicitLinking:true,allowDifferentEmails:false});
  expect(auth.options.user).not.toHaveProperty("additionalFields.role");expect(auth.options.advanced?.database?.generateId).toBe("uuid");
 });
});

describe("additional lifecycle and explicit dev safeguards",()=>{
 it("password reset revokes sessions and token cannot be reused",async()=>{
  const user=await signup("reset@borynx.test");
  await db.execute(sql`update auth_users set email_verified=true where id=${user.user.id}`);
  const response=await auth.api.signInEmail({body:{email:user.user.email,password},headers,asResponse:true});
  const cookie=response.headers.get("set-cookie")!.split(";")[0];
  await auth.api.requestPasswordReset({body:{email:user.user.email,redirectTo:"http://localhost:3000/reset-password"},headers});
  const url=new URL(mail.find(m=>m.to===user.user.email&&m.purpose==="password-reset")!.url);
  const token=url.searchParams.get("token")??url.pathname.split("/").pop()!;
  const newPassword=crypto.randomUUID()+"!";
  await auth.api.resetPassword({body:{token,newPassword},headers});
  expect(await auth.api.getSession({headers:new Headers({cookie})})).toBeNull();
  await expect(auth.api.signInEmail({body:{email:user.user.email,password},headers})).rejects.toThrow();
  expect((await auth.api.signInEmail({body:{email:user.user.email,password:newPassword},headers})).user.id).toBe(user.user.id);
  await expect(auth.api.resetPassword({body:{token,newPassword},headers})).rejects.toThrow();
 });
 it("auth HTTP handler rejects foreign mutation origin",async()=>{
  const response=await guardedAuthHandler(r=>auth.handler(r),env)(new Request("http://localhost:3000/api/auth/sign-up/email",{method:"POST",headers:{origin:"https://evil.invalid",cookie:"borynx.session_token=fixture","content-type":"application/json"},body:JSON.stringify({email:"attack@borynx.test",password,name:"Attack"})}));
  expect(response.status).toBe(403);
 });
 it("four demo accounts seed twice with correct authoritative roles and representative records",async()=>{
  const local=new PGlite();try{
   for(const name of readdirSync("src/server/db/migrations").filter(n=>/^\d+.*\.sql$/.test(n)).sort())await local.exec(readFileSync("src/server/db/migrations/"+name,"utf8"));
   const seedDb=drizzle(local);const seedAuth=createBorynxAuth(seedDb,async()=>{},env,false);
   await seedDevelopment(seedDb,seedAuth,password);await seedDevelopment(seedDb,seedAuth,password);
   const users=await local.query<{email:string;role:string;uid:string;id:string}>("select u.email,u.id,p.uid,p.role from auth_users u join profiles p on p.uid=u.id");expect(users.rows).toHaveLength(4);
   for(const account of DEMO_ACCOUNTS)expect(users.rows.find(u=>u.email===account.email)).toMatchObject({role:account.role});
   expect(users.rows.every(u=>u.id===u.uid)).toBe(true);
   for(const table of ["posts","leads","reports"])expect((await local.query(`select id from ${table}`)).rows).toHaveLength(1);
  }finally{await local.close();}
 });
});
