import { DEMO_ACCOUNTS, localDemoRequest } from "@/server/auth/development";
import { trustedMutation } from "@/server/auth/config";
import { getAuth } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { sql } from "drizzle-orm";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const absent=()=>new Response(null,{status:404});
export async function GET(request:Request){
  if(process.env.NODE_ENV!=="development" || !localDemoRequest(request))return absent();
  return Response.json({accounts:DEMO_ACCOUNTS.map(({key,name})=>({key,name}))},{headers:{"cache-control":"no-store"}});
}
export async function POST(request:Request){
  if(process.env.NODE_ENV!=="development" || !localDemoRequest(request))return absent();
  if(!trustedMutation(request))return new Response(null,{status:403});
  try{
    const body=await request.json(),account=DEMO_ACCOUNTS.find(a=>a.key===body.account);
    if(!account)return new Response(null,{status:400});
    // Direct auth.api calls bypass Better Auth's HTTP limiter. Atomic DB-backed
    // global local-demo limiter, across workers, before password authentication.
    const window=Math.floor(Date.now()/60000),key=`local-demo:${window}`;
    const result=await getDatabase().execute(sql`insert into auth_rate_limits (key,count,last_request) values (${key},1,${Date.now()}) on conflict (key) do update set count=auth_rate_limits.count+1 returning count`);
    if(Number(result.rows[0]?.count)>10)return new Response(null,{status:429});
    const proof=await getDatabase().execute(sql`select s.user_id from public.development_seed_identities s join public.auth_users u on u.id=s.user_id and u.email=s.email where s.email=${account.email} and s.purpose=${account.key} and u.email_verified=true`);
    if(!proof.rows.length)return new Response(null,{status:409});
    // Password never crosses the browser boundary. Better Auth verifies the
    // credential and emits the SAME signed opaque session cookie as normal login.
    return await getAuth().api.signInEmail({body:{email:account.email,password:process.env.BORYNX_DEMO_PASSWORD!},headers:request.headers,asResponse:true});
  }catch{return Response.json({error:"demo_login_unavailable"},{status:503});}
}
