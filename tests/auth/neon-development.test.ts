import {describe,it,expect,vi} from "vitest";
import type {PoolClient} from "pg";
import {developmentTarget,developmentResetConfirmation,verifyDevelopmentConnection} from "../../src/server/auth/development-target";
import {demoEnabled,localDemoRequest} from "../../src/server/auth/development";
import {approveReset} from "../../scripts/development/plan";
import {developmentConnectionVerifier} from "../../scripts/development/connection";
const host="ep-example-fixture.eu-central-1.aws.neon.tech";
const env={NODE_ENV:"development",BORYNX_ENVIRONMENT:"development",DATABASE_URL:`postgresql://fixture@${host}/neondb?sslmode=require&channel_binding=require`,BORYNX_DEV_DATABASE_TARGET:"neon",BORYNX_DEV_DATABASE_HOST:host,BORYNX_DEV_DATABASE_NAME:"neondb",BORYNX_DEV_DATABASE_USER:"fixture",BORYNX_ALLOW_NEON_DEV_DATA:"true",BORYNX_DEV_DATA_DISPOSABLE:"true",BORYNX_ALLOW_DEV_RESET:"true",BETTER_AUTH_URL:"http://localhost:3000",BORYNX_ENABLE_DEMO_LOGIN:"true",BORYNX_DEMO_PASSWORD:crypto.randomUUID()} as NodeJS.ProcessEnv;
describe("explicit existing Neon target (pure/mock only; never connects)",()=>{
 it("accepts exact designated host/database/user with verified TLS parameters",()=>expect(developmentTarget(env)).toEqual({kind:"neon",host,database:"neondb",user:"fixture"}));
 it.each([
  {NODE_ENV:"production"},{BORYNX_ENVIRONMENT:"production"},{BORYNX_ALLOW_NEON_DEV_DATA:"false"},{BORYNX_DEV_DATA_DISPOSABLE:"false"},
  {BORYNX_DEV_DATABASE_TARGET:"local"},{BORYNX_DEV_DATABASE_HOST:"other.neon.tech"},{BORYNX_DEV_DATABASE_NAME:"other"},{BORYNX_DEV_DATABASE_USER:"other"},
  {DATABASE_URL:`postgresql://fixture@${host.replace('fixture.','fixture-pooler.')}/neondb`},
  {DATABASE_URL:"postgresql://fixture@evil.invalid/neondb"},{DATABASE_URL:`postgresql://fixture@${host}.evil.invalid/neondb`},
  {DATABASE_URL:`postgresql://fixture@${host}:5433/neondb`},
 ])("refuses unsafe or mismatched designation %j",override=>expect(()=>developmentTarget({...env,...override} as NodeJS.ProcessEnv)).toThrow());
 it.each(["host=evil.invalid","user=other","dbname=other","options=-csearch_path=evil","sslmode=disable","sslmode=no-verify","sslmode=require&sslmode=require","channel_binding=disable","port=1"])("refuses connection query override %s",query=>expect(()=>developmentTarget({...env,DATABASE_URL:`postgresql://fixture@${host}/neondb?${query}`})).toThrow());
 it("requires full endpoint/database/user destructive confirmation in addition to reset flag",()=>{
  expect(()=>approveReset(env,["--apply","--confirm=neondb:DELETE-ALL-DEVELOPMENT-DATA"])).toThrow();
  expect(approveReset(env,["--apply",`--confirm=${developmentResetConfirmation(env)}`])).toEqual({database:"neondb"});
  expect(()=>approveReset({...env,BORYNX_ALLOW_DEV_RESET:"false"},["--apply",`--confirm=${developmentResetConfirmation(env)}`])).toThrow();
 });
 it("validates connected database/user, a server IP and actual client TLS authorization",()=>{
  const target=developmentTarget(env),identity={database:"neondb",role:"fixture",host:"10.0.0.2",tls:true};
  expect(()=>verifyDevelopmentConnection(target,identity)).not.toThrow();
  for(const override of [{database:"other"},{role:"other"},{host:null},{tls:false}])expect(()=>verifyDevelopmentConnection(target,{...identity,...override})).toThrow();
 });
 it("callback verifier completes once on success and refuses plaintext, TLS failure and query errors",async()=>{
  async function verify(tls:boolean,authorized:boolean,reject=false){
   const query=vi.fn(async()=>{if(reject)throw Error("private query details");return {rows:[{database:"neondb",role:"fixture",host:"10.0.0.2"}]};});
   const client={query,connection:{stream:{encrypted:tls,authorized}}} as unknown as PoolClient;
   return new Promise<Error|undefined>(resolve=>developmentConnectionVerifier(developmentTarget(env))(client,resolve));
  }
  expect(await verify(true,true)).toBeUndefined();
  for(const args of [[false,false,false],[true,false,false],[true,true,true]])expect((await verify(...args as [boolean,boolean,boolean]))?.message).toBe("development_connection_refused");
 });
 it("Neon-backed demo stays local-browser-only and production-disabled",()=>{
  expect(demoEnabled(env)).toBe(true);expect(localDemoRequest(new Request("http://localhost:3000/api/dev/demo-login"),env)).toBe(true);
  expect(localDemoRequest(new Request("https://remote.invalid/api/dev/demo-login"),env)).toBe(false);expect(demoEnabled({...env,NODE_ENV:"production"})).toBe(false);
 });
});
