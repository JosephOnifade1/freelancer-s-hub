"use client";
import {useEffect,useState} from "react";
import {Button} from "@/components/ui/button";
export function DemoAccounts(){
 const [accounts,setAccounts]=useState<{key:string;name:string}[]>([]),[pending,setPending]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{if(process.env.NODE_ENV!=="development")return;let active=true;void fetch("/api/dev/demo-login",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(active&&data?.accounts)setAccounts(data.accounts);}).catch(()=>{});return()=>{active=false;};},[]);
 if(process.env.NODE_ENV!=="development" || !accounts.length)return null;
 return <section aria-label="Demo Accounts" className="mt-4 space-y-2"><h2 className="font-semibold">Demo Accounts</h2><p className="text-xs text-muted-foreground">Local development only. Uses normal authenticated sessions and permissions.</p>{accounts.map(account=><Button key={account.key} variant="outline" className="w-full" disabled={pending} onClick={async()=>{setPending(true);setError(false);try{const r=await fetch("/api/dev/demo-login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({account:account.key})});if(!r.ok)throw Error();window.location.assign("/");}catch{setError(true);setPending(false);}}}>{account.name}</Button>)}{error&&<p role="alert">Demo sign-in failed. Confirm local seed configuration.</p>}</section>;
}
