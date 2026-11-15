import {developmentConnectionVerifier} from "./connection";
import {executeDevelopmentReset} from "./reset";
import {seedDevelopment} from "./seed";
/** Owner-local ONLY. No automatic .env loading, no provider operations, no raw errors. */
import {readFileSync} from "node:fs";
import {parse} from "dotenv";
import {drizzle} from "drizzle-orm/node-postgres";
import {Pool} from "pg";
import {resolveConnectionSettings} from "../../src/server/db/env";
import {poolOptions} from "../../src/server/db/pool-options.mjs";
import {developmentTarget,developmentResetConfirmation} from "../../src/server/auth/development-target";
import {createBorynxAuth} from "../../src/server/auth/factory";
import {RESET_TABLES,approveReset} from "./plan";
const [command,...args]=process.argv.slice(2);
const names=["DATABASE_URL","DATABASE_POOL_MAX","DATABASE_SSL_CA","NODE_ENV","BORYNX_ENVIRONMENT","BORYNX_DEV_DATABASE_NAME","BORYNX_DEV_DATABASE_TARGET","BORYNX_DEV_DATABASE_HOST","BORYNX_DEV_DATABASE_USER","BORYNX_ALLOW_NEON_DEV_DATA","BORYNX_DEV_DATA_DISPOSABLE","BORYNX_ALLOW_DEV_RESET","BORYNX_ALLOW_DEV_SEED","BORYNX_DEMO_PASSWORD","BETTER_AUTH_SECRET","BETTER_AUTH_URL","BETTER_AUTH_TRUSTED_ORIGINS"];
async function run(){
 if(!["plan","reset","seed"].includes(command))throw Error("invalid_command");
 const fileIndex=args.indexOf("--env-file");
 if(fileIndex>=0){const file=parse(readFileSync(args[fileIndex+1]));for(const name of names)if(Object.hasOwn(file,name))process.env[name]=file[name];args.splice(fileIndex,2);}
 const target=developmentTarget();
 if(command==="plan"){
  if(args.length)throw Error("invalid_arguments");
  console.log("PLAN ONLY; no connection. Target kind: "+target.kind+". Review your designated target privately.");
  console.log("Reset confirmation argument: --confirm="+developmentResetConfirmation());
  console.log("DELETE rows, in order: "+RESET_TABLES.map(table=>`public.${table}`).join(", "));
  console.log("Keep all table definitions, constraints and drizzle migration history. Supabase objects untouched.");return;
 }
 if(command==="reset")approveReset(process.env,args);
 else if(process.env.BORYNX_ALLOW_DEV_SEED!=="true" || args.join(" ")!=="--apply" || (process.env.BORYNX_DEMO_PASSWORD?.length??0)<20)throw Error("explicit_seed_approval_required");
 if(command==="reset" && (args.length!==2 || !args.includes("--apply")))throw Error("invalid_arguments");
 if(Number(process.env.DATABASE_POOL_MAX??10)<2)throw Error("development_tools_need_two_connections");
 const options=poolOptions(resolveConnectionSettings(process.env.DATABASE_URL!,process.env.DATABASE_SSL_CA??""),process.env.DATABASE_POOL_MAX);
 // Check each newly established connection before handing it to Drizzle.
 const pool=new Pool({...options,verify:developmentConnectionVerifier(target)});
 pool.on("error",()=>{});
 try{
  const db=drizzle(pool);
  // Direct endpoint preserves this session-scoped lock across statements.
  const lock=await pool.connect();
  try{
   await lock.query("select pg_advisory_lock(2182304)");
   if(command==="reset"){
    await executeDevelopmentReset(db);
    console.log("PASS_EXPLICIT_DESIGNATED_DEVELOPMENT_ROW_RESET; schema/history/files unchanged");
   }else{
    await seedDevelopment(db,createBorynxAuth(db,async()=>{},process.env,false),process.env.BORYNX_DEMO_PASSWORD!);
    console.log("PASS FOUR_DEVELOPMENT_IDENTITIES_AND_NEON_ROLES; freelancer/client=member; moderator=moderator; admin=admin");
   }
  }finally{await lock.query("select pg_advisory_unlock(2182304)");lock.release();}
 }finally{await pool.end();}
}
run().catch(()=>{console.error("FAIL DEVELOPMENT_OPERATION_REFUSED_OR_FAILED; review local target, approvals and guide. Details suppressed.");process.exitCode=1;});
