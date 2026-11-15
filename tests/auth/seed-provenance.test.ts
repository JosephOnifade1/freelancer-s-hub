import {describe,it,expect} from "vitest";
import {securityFixture} from "./security-fixture";
import {createBorynxAuth} from "../../src/server/auth/factory";
import {seedDevelopment} from "../../scripts/development/seed";
import {DEMO_ACCOUNTS} from "../../src/server/auth/development";
import {sql} from "drizzle-orm";
const password=crypto.randomUUID()+"!";
const env={NODE_ENV:"test",DATABASE_URL:"postgresql://unused@127.0.0.1/borynx_test",BETTER_AUTH_URL:"http://localhost:3000",BETTER_AUTH_SECRET:crypto.randomUUID()+crypto.randomUUID()} as NodeJS.ProcessEnv;
async function fixture(){const f=await securityFixture();return {...f,auth:createBorynxAuth(f.db,async()=>{},env,false)};}
describe("seed identity provenance and crash recovery (embedded only)",()=>{
 it("fresh seed and repeat retain same UUID/proof and authoritative roles",async()=>{
  const {engine,db,auth}=await fixture();try{
   await seedDevelopment(db,auth,password);const before=(await engine.query("select * from development_seed_identities order by email")).rows;
   await seedDevelopment(db,auth,password);expect((await engine.query("select * from development_seed_identities order by email")).rows).toEqual(before);
   const users=(await engine.query<{email:string;role:string;email_verified:boolean}>("select u.email,u.email_verified,p.role from auth_users u join profiles p on p.uid=u.id join development_seed_identities s on s.user_id=u.id and s.email=u.email")).rows;
   expect(users).toHaveLength(4);for(const account of DEMO_ACCOUNTS)expect(users.find(u=>u.email===account.email)).toMatchObject({role:account.role,email_verified:true});
  }finally{await engine.close();}
 });
 it.each(["freelancer","admin"])("refuses unproven preexisting %s identity without changing credential, verification, profile or roles",async key=>{
  const {engine,db,auth}=await fixture();try{
   const account=DEMO_ACCOUNTS.find(a=>a.key===key)!;
   const user=await auth.api.signUpEmail({body:{email:account.email,password:crypto.randomUUID(),name:"Unrelated owner"}});
   await db.execute(sql`insert into profiles(uid,username,"displayName") values(${user.user.id},'unrelated','Unrelated owner')`);
   const before=(await engine.query("select * from auth_users u join auth_accounts a on a.user_id=u.id join profiles p on p.uid=u.id")).rows;
   await expect(seedDevelopment(db,auth,password)).rejects.toThrow("unproven_seed_identity");
   expect((await engine.query("select * from auth_users u join auth_accounts a on a.user_id=u.id join profiles p on p.uid=u.id")).rows).toEqual(before);
   expect((await engine.query("select * from development_seed_identities")).rows).toHaveLength(0);
  }finally{await engine.close();}
 });
 it.each(["identity","profile"] as const)("recovers after committed %s stage without adopting any unrelated user",async stage=>{
  const {engine,db,auth}=await fixture();try{
   await expect(seedDevelopment(db,auth,password,async(current,key)=>{if(current===stage&&key==="freelancer")throw Error("injected crash");})).rejects.toThrow("injected crash");
   const user=(await engine.query<{id:string;email_verified:boolean}>("select id,email_verified from auth_users")).rows[0];expect(user.email_verified).toBe(false);
   expect((await engine.query("select * from development_seed_identities where user_id=$1",[user.id])).rows).toHaveLength(1);
   expect((await engine.query("select * from profiles where uid=$1 and role<>'member'",[user.id])).rows).toHaveLength(0);
   await seedDevelopment(db,auth,password);
   expect((await engine.query("select * from auth_users")).rows).toHaveLength(4);
   expect((await engine.query("select * from auth_users where id=$1",[user.id])).rows).toHaveLength(1);
  }finally{await engine.close();}
 });
 it("provenance insert failure rolls back Better Auth user AND credential creation",async()=>{
  const {engine,db,auth}=await fixture();try{
   await engine.exec("create function reject_seed() returns trigger language plpgsql as $$ begin raise exception 'injected provenance failure'; end $$;create trigger reject_seed before insert on development_seed_identities for each row execute function reject_seed()");
   await expect(seedDevelopment(db,auth,password)).rejects.toThrow();
   expect((await engine.query("select * from auth_users")).rows).toHaveLength(0);expect((await engine.query("select * from auth_accounts")).rows).toHaveLength(0);
   await engine.exec("drop trigger reject_seed on development_seed_identities");await seedDevelopment(db,auth,password);expect((await engine.query("select * from auth_users")).rows).toHaveLength(4);
  }finally{await engine.close();}
 });
});
