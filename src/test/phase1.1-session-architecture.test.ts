// @vitest-environment node
import {describe,it,expect} from "vitest";
import {readFileSync,readdirSync} from "node:fs";
const read=(p:string)=>readFileSync(p,"utf8");
const walk=(p:string):string[]=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${p}/${e.name}`):/\.[jt]sx?$/.test(e.name)?[`${p}/${e.name}`]:[]);
describe("single Better Auth identity architecture",()=>{
 it("no active Supabase Auth/SSR consumers remain",()=>{for(const p of walk("src").filter(p=>!p.includes("/test/")&&!p.includes(".test.")))expect(read(p),p).not.toMatch(/supabase\.auth\.|from ["']@supabase\/ssr/);});
 it("all server features retain central session boundary",()=>{for(const d of ["identity","profile","content","social","marketplace","trust"])expect(read(`src/server/features/${d}/index.ts`)).toContain("getServerSession");});
 it("server session validates verification and UUID; no supplied UID",()=>{const source=read("src/lib/server-session.ts");expect(source).toContain("getAuth().api.getSession");expect(source).toContain("emailVerified");expect(source).toContain("isValidUid");expect(source).not.toContain("request.json");});
 it("provider uses reactive single session, cache reset and bounded independent provisioning",()=>{const source=read("src/hooks/useAuth.tsx");for(const symbol of ["authClient.useSession","queryClient.clear()","lastUid","shouldAttemptAutomatically","retryProvisioning"])expect(source).toContain(symbol);});
 it("database credentials remain server-only; public client is same-origin",()=>{expect(read("src/lib/auth-client.ts")).not.toMatch(/DATABASE_URL|BETTER_AUTH_SECRET|BORYNX_DEMO_PASSWORD/);expect(read("src/server/auth/index.ts")).toMatch(/^import "server-only"/);});
});
