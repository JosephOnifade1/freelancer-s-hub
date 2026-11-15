import {afterEach,describe,it,expect,vi} from "vitest";
const fixtures=vi.hoisted(()=>({enabled:true,rows:[] as {purpose:string;email:string}[],fail:false,db:vi.fn()}));
vi.mock("@/server/auth/development",async importOriginal=>({...await importOriginal<typeof import("../../src/server/auth/development")>(),localDemoRequest:()=>fixtures.enabled}));
vi.mock("@/server/auth",()=>({getAuth:vi.fn(()=>{throw Error("unexpected auth call");})}));
vi.mock("@/server/db",()=>({getDatabase:()=>({execute:fixtures.db})}));
import {GET} from "../../src/app/api/dev/demo-login/route";
const request=()=>new Request("http://localhost:3000/api/dev/demo-login");
afterEach(()=>{vi.unstubAllEnvs();fixtures.db.mockReset();fixtures.enabled=true;});
describe("demo discovery does not seed or authenticate",()=>{
 it("hides in production and on remote hosts without DB access",async()=>{
  vi.stubEnv("NODE_ENV","production");expect((await GET(request())).status).toBe(404);
  vi.stubEnv("NODE_ENV","development");expect((await GET(new Request("https://example.com/api/dev/demo-login"))).status).toBe(404);expect(fixtures.db).not.toHaveBeenCalled();
 });
 it("reports incomplete setup without opening the database",async()=>{
  vi.stubEnv("NODE_ENV","development");fixtures.enabled=false;expect(await (await GET(request())).json()).toMatchObject({status:"setup-required",accounts:[]});expect(fixtures.db).not.toHaveBeenCalled();
 });
 it("requires exact known purpose and email for readiness",async()=>{
  vi.stubEnv("NODE_ENV","development");fixtures.db.mockResolvedValue({rows:[{purpose:"freelancer",email:"freelancer@borynx.test"},{purpose:"admin",email:"wrong@borynx.test"}]});
  const data=await (await GET(request())).json();expect(data.accounts).toEqual(expect.arrayContaining([{key:"freelancer",name:"Demo Freelancer",ready:true},{key:"admin",name:"Demo Admin",ready:false}]));
  expect(fixtures.db).toHaveBeenCalledTimes(1);
 });
 it("does not leak database errors",async()=>{
  vi.stubEnv("NODE_ENV","development");fixtures.db.mockRejectedValue(Error("private connection detail"));const response=await GET(request());expect(response.status).toBe(503);expect(await response.text()).not.toContain("private");
 });
});
