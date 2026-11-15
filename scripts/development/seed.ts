import {randomUUID} from "node:crypto";
import {betterAuth} from "better-auth";
import {drizzleAdapter} from "@better-auth/drizzle-adapter";
import * as tables from "../../src/server/db/schema/auth";
import {sql} from "drizzle-orm";
import {DEMO_ACCOUNTS} from "../../src/server/auth/development";
import {provisionProfile} from "../../src/server/features/identity/provision-profile";
import {claimUsername} from "../../src/server/features/identity/claim-username";
import type {createBorynxAuth} from "../../src/server/auth/factory";
/** Internal seed service. CLI performs loopback target + explicit consent guards. */
export async function seedDevelopment(db:Parameters<typeof claimUsername>[0] & { execute: (query: ReturnType<typeof sql>) => Promise<{rows:Record<string,unknown>[]}> },auth:ReturnType<typeof createBorynxAuth>,password:string,checkpoint?:(stage:"identity"|"profile",key:string)=>Promise<void>){
    // Validate ALL existing identities before mutating any account/profile.
    const existing=await db.execute(sql`select u.id,u.email,s.user_id,s.purpose,s.owner from public.auth_users u left join public.development_seed_identities s on s.user_id=u.id and s.email=u.email`);
    for(const row of existing.rows){
      const account=DEMO_ACCOUNTS.find(a=>a.email===row.email);
      if(!account||row.user_id!==row.id||row.purpose!==account.key||!row.owner)throw Error("unproven_seed_identity");
    }
    for(const account of DEMO_ACCOUNTS){
     const uid=await db.transaction(async tx=>{
      const found=await tx.execute(sql`select u.id,s.user_id,s.purpose,s.email from public.auth_users u left join public.development_seed_identities s on s.user_id=u.id where u.email=${account.email} for update of u`);
      const row=(found as {rows:Record<string,unknown>[]}).rows[0];
      if(row){if(row.user_id!==row.id||row.purpose!==account.key||row.email!==account.email)throw Error("unproven_seed_identity");return String(row.id);}
      // Both BA account creation and registry insertion share an outer transaction.
      // Crash before provenance commits rolls the credential/user back as well.
      const seedAuth=betterAuth({...auth.options,plugins:[],database:drizzleAdapter(tx,{provider:"pg",transaction:true,schema:{...tables}})});
      const created=await seedAuth.api.signUpEmail({body:{email:account.email,password,name:account.name}});
      const id=created.user.id;
      await tx.execute(sql`insert into public.development_seed_identities(user_id,email,purpose,owner) values(${id},${account.email},${account.key},${randomUUID()})`);
      return id;
     });
     await checkpoint?.("identity",account.key);
     const provisioned=await provisionProfile(db,{uid,displayName:account.name});if(!provisioned.ok)throw Error("seed_profile_failed");
     const claim=await claimUsername(db,{uid,desired:account.username});if(claim.status!=="claimed" && claim.status!=="same")throw Error("seed_handle_failed");
     await checkpoint?.("profile",account.key);
     await db.transaction(async tx=>{
      // Recheck provenance in the privilege-assignment transaction, never email alone.
      const proof=await tx.execute(sql`select user_id from public.development_seed_identities where user_id=${uid} and email=${account.email} and purpose=${account.key} for update`);
      if(!(proof as {rows:unknown[]}).rows.length)throw Error("seed_provenance_lost");
      await tx.execute(sql`update auth_users set email_verified=true where id=${uid}`);
      await tx.execute(sql`update profiles set role=${account.role},bio=${account.key==="freelancer"?"Freelance frontend engineer and UI designer. Portfolio: accessible web experiences.":account.key==="client"?"Client looking for a freelance product partner.":"Local development demonstration account."},skills=${account.key==="freelancer"?sql`ARRAY['React','TypeScript','Design']::text[]`:sql`ARRAY[]::text[]`} where uid=${uid}`);
      if(account.key==="freelancer")await tx.execute(sql`insert into posts (id,title,body,type,"authorUid") values ('00000000-0000-4000-8000-000000000101','Demo portfolio: accessible web design','A representative portfolio project using React and TypeScript.','resource',${uid}) on conflict(id) do nothing`);
      if(account.key==="client")await tx.execute(sql`insert into leads (id,title,description,budget,currency,location,type,"postedByUid") values ('00000000-0000-4000-8000-000000000102','Demo client website project','Seeking an accessible, responsive marketing website.','1500','USD','Remote','Project',${uid}) on conflict(id) do nothing`);
      if(account.key==="moderator")await tx.execute(sql`insert into reports (id,"reporterUid","entityType","entityId",reason,details) values ('00000000-0000-4000-8000-000000000103',${uid},'post','00000000-0000-4000-8000-000000000101','other','Demonstration moderation queue entry; no real abuse.') on conflict(id) do nothing`);
     });
    }

}
