import {sql} from "drizzle-orm";
import {DEMO_ACCOUNTS} from "../../src/server/auth/development";
import {provisionProfile} from "../../src/server/features/identity/provision-profile";
import {claimUsername} from "../../src/server/features/identity/claim-username";
import type {createBorynxAuth} from "../../src/server/auth/factory";
/** Internal seed service. CLI performs loopback target + explicit consent guards. */
export async function seedDevelopment(db:Parameters<typeof claimUsername>[0] & { execute: (query: ReturnType<typeof sql>) => Promise<{rows:Record<string,unknown>[]}> },auth:ReturnType<typeof createBorynxAuth>,password:string){
    const existing=await db.execute(sql`select email from auth_users`);
    if(existing.rows.some(r=>!DEMO_ACCOUNTS.some(a=>a.email===r.email)))throw Error("clean_development_auth_required");
    // Never send seed verification emails, even if an operator has email configured.
    
    for(const account of DEMO_ACCOUNTS){
     let rows=await db.execute(sql`select id from auth_users where email=${account.email}`);
     if(!rows.rows.length){await auth.api.signUpEmail({body:{email:account.email,password:password,name:account.name}});rows=await db.execute(sql`select id from auth_users where email=${account.email}`);}
     const uid=String(rows.rows[0]?.id??"");if(!uid)throw Error("seed_identity_failed");
     const provisioned=await provisionProfile(db,{uid,displayName:account.name});if(!provisioned.ok)throw Error("seed_profile_failed");
     const claim=await claimUsername(db,{uid,desired:account.username});if(claim.status!=="claimed" && claim.status!=="same")throw Error("seed_handle_failed");
     await db.transaction(async tx=>{
      await tx.execute(sql`update auth_users set email_verified=true where id=${uid}`);
      await tx.execute(sql`update profiles set role=${account.role},bio=${account.key==="freelancer"?"Freelance frontend engineer and UI designer. Portfolio: accessible web experiences.":account.key==="client"?"Client looking for a freelance product partner.":"Local development demonstration account."},skills=${account.key==="freelancer"?sql`ARRAY['React','TypeScript','Design']::text[]`:sql`ARRAY[]::text[]`} where uid=${uid}`);
      if(account.key==="freelancer")await tx.execute(sql`insert into posts (id,title,body,type,"authorUid") values ('00000000-0000-4000-8000-000000000101','Demo portfolio: accessible web design','A representative portfolio project using React and TypeScript.','resource',${uid}) on conflict(id) do nothing`);
      if(account.key==="client")await tx.execute(sql`insert into leads (id,title,description,budget,currency,location,type,"postedByUid") values ('00000000-0000-4000-8000-000000000102','Demo client website project','Seeking an accessible, responsive marketing website.','1500','USD','Remote','Project',${uid}) on conflict(id) do nothing`);
      if(account.key==="moderator")await tx.execute(sql`insert into reports (id,"reporterUid","entityType","entityId",reason,details) values ('00000000-0000-4000-8000-000000000103',${uid},'post','00000000-0000-4000-8000-000000000101','other','Demonstration moderation queue entry; no real abuse.') on conflict(id) do nothing`);
     });
    }

}
