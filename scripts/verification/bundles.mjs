import {existsSync,readdirSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {insist} from "./common.mjs";
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);
/** Offline scan. No matching content/secret/filename excerpts are printed. */
export function verifyBrowserBundles(env,output,roots=[".next/static","dist"]){
 const secrets=[env.DATABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,env.DATABASE_SSL_CA].filter(v=>typeof v==="string"&&v.length>=8);
 for(const root of roots){
  insist(existsSync(root),"BROWSER_BUILD_MISSING");
  for(const file of walk(root).filter(f=>/\.(?:js|map|html|css)$/.test(f))){
   const content=readFileSync(file,"utf8");
   insist(!/SUPABASE_SERVICE_ROLE_KEY|DATABASE_SSL_CA|process\.env\.DATABASE_URL/.test(content),"SERVER_CREDENTIAL_MARKER_IN_BROWSER_BUILD");
   insist(!secrets.some(secret=>content.includes(secret)||content.includes(JSON.stringify(secret).slice(1,-1))),"SECRET_VALUE_IN_BROWSER_BUILD");
  }
 }
 output("PASS BROWSER_BUILD_SECRET_SCAN (limited static check, not a full secret audit)");
}
