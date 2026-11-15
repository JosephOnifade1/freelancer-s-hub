import {describe,it,expect} from "vitest";
import {readFileSync} from "node:fs";
import {approveReset,RESET_TABLES} from "../../scripts/development/plan";
import {requireDevelopmentTarget,demoEnabled,localDemoRequest} from "../../src/server/auth/development";
import {authConfiguration} from "../../src/server/auth/config";
const env={NODE_ENV:"development",BORYNX_ENVIRONMENT:"development",DATABASE_URL:"postgresql://fixture@127.0.0.1/borynx_test",BORYNX_DEV_DATABASE_NAME:"borynx_test",BORYNX_ALLOW_DEV_RESET:"true",BETTER_AUTH_URL:"http://localhost:3000",BETTER_AUTH_SECRET:crypto.randomUUID(),BORYNX_ENABLE_DEMO_LOGIN:"true",BORYNX_DEMO_PASSWORD:crypto.randomUUID()} as NodeJS.ProcessEnv;
describe("development gates (pure, never execute reset)",()=>{
 it("requires exact target designation and destructive confirmation",()=>{expect(()=>approveReset(env,[])).toThrow();expect(()=>approveReset(env,["--apply"])).toThrow();expect(approveReset(env,["--apply","--confirm=borynx_test:DELETE-ALL-DEVELOPMENT-DATA"])).toEqual({database:"borynx_test"});expect(new Set(RESET_TABLES).size).toBe(RESET_TABLES.length);expect(RESET_TABLES).not.toContain("__drizzle_migrations");});
 it.each([{NODE_ENV:"production"},{BORYNX_ENVIRONMENT:"production"},{BORYNX_DEV_DATABASE_NAME:"other"},{DATABASE_URL:"postgresql://fixture@remote.invalid/borynx_test"},{DATABASE_URL:"postgresql://fixture@localhost/production"},{DATABASE_URL:"postgresql://fixture@localhost/borynx_test?options=anything"},{BORYNX_ALLOW_DEV_RESET:"false"}])("rejects unsafe reset override %j",override=>expect(()=>approveReset({...env,...override} as NodeJS.ProcessEnv,["--apply","--confirm=borynx_test:DELETE-ALL-DEVELOPMENT-DATA"])).toThrow());
 it("demo requires local request and is disabled in production despite flags",()=>{expect(demoEnabled(env)).toBe(true);expect(demoEnabled({...env,NODE_ENV:"production"})).toBe(false);expect(localDemoRequest(new Request("https://remote.invalid"),env)).toBe(false);expect(localDemoRequest(new Request("http://localhost:3000/api/dev/demo-login"),env)).toBe(true);});
 it("browser demo contains no passwords or direct privileged login",()=>{const source=readFileSync("src/components/auth/DemoAccounts.tsx","utf8");expect(source).not.toMatch(/BORYNX_DEMO_PASSWORD|signInEmail|SERVICE_ROLE_KEY/);expect(source).toContain('process.env.NODE_ENV!=="development"');});
 it("origins are exact and production HTTP is rejected",()=>{expect(()=>authConfiguration({...env,BETTER_AUTH_TRUSTED_ORIGINS:"https://*.invalid"})).toThrow();expect(()=>authConfiguration({...env,NODE_ENV:"production"})).toThrow();});
});
