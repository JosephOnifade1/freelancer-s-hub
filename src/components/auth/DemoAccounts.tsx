"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
type Account={key:string;name:string;ready:boolean};
export function DemoAccounts(){
 const [accounts,setAccounts]=useState<Account[]>([]);
 const [status,setStatus]=useState("loading");
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(process.env.NODE_ENV!=="development"||!["localhost","127.0.0.1","[::1]"].includes(window.location.hostname))return;
  let active=true;const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  setStatus("loading");
  void fetch("/api/dev/demo-login",{cache:"no-store",signal:controller.signal}).then(async r=>{
   if(!r.ok)throw Error();return r.json();
  }).then(data=>{if(active){setAccounts(data.accounts??[]);setStatus(data.status??"unavailable");}}).catch(()=>{if(active)setStatus("unavailable");}).finally(()=>clearTimeout(timeout));
  return()=>{active=false;clearTimeout(timeout);controller.abort();};
 },[attempt]);
 if(process.env.NODE_ENV!=="development"||!["localhost","127.0.0.1","[::1]"].includes(window.location.hostname))return null;
 return <section aria-label="Demo Accounts" className="mt-4 space-y-2">
  <h2 className="font-semibold">Demo Accounts</h2>
  <p className="text-xs text-muted-foreground">Local development only. Uses normal authenticated sessions and permissions.</p>
  {status==="loading"?<p role="status">Checking demo setup…</p>:status!=="enabled"?<p role="status">Demo accounts are not available. Check the demo flags, designated database and seed instructions in NEON_OWNER_SETUP.md. Nothing is seeded automatically.</p>:null}
  {accounts.map(account=><Button key={account.key} variant="outline" className="w-full" disabled={pending||!account.ready} onClick={async()=>{
   setPending(true);setError("");
   try{
    const r=await fetch("/api/dev/demo-login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({account:account.key}),signal:AbortSignal.timeout(15000)});
    if(!r.ok){setError(r.status===409?"This verified seed account is missing. Follow the owner seed instructions.":r.status===429?"Too many attempts. Wait a minute before retrying.":"Demo sign-in failed. Check the configured demo password, database and seed setup.");setPending(false);return;}
    window.location.assign("/");
   }catch{setError("Demo sign-in could not be confirmed. Check your connection and retry.");setPending(false);}
  }}>{account.name}{!account.ready?" — not seeded":""}</Button>)}
  {accounts.some(a=>!a.ready)&&<p role="status" className="text-xs">Missing verified seed identities. Follow NEON_OWNER_SETUP.md to explicitly seed your designated disposable database. Existing users are never adopted by email.</p>}
  <Button type="button" variant="ghost" disabled={pending||status==="loading"} onClick={()=>setAttempt(n=>n+1)}>Recheck setup</Button>
  {error&&<p role="alert">{error}</p>}
 </section>;
}
