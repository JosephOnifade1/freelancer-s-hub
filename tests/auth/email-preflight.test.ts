import {afterEach,expect,it,vi} from "vitest";
const fixture=vi.hoisted(()=>({auth:vi.fn()}));
vi.mock("@/server/auth",()=>({getAuth:fixture.auth}));
import {POST} from "../../src/app/api/auth/[...all]/route";
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it("rejects disabled mail before calling auth and retains origin enforcement",async()=>{
 vi.stubEnv("DATABASE_URL","postgresql://fixture@localhost/example");vi.stubEnv("BETTER_AUTH_SECRET","synthetic-secret-for-test-only-123456789");vi.stubEnv("BETTER_AUTH_URL","http://localhost:3000");vi.stubEnv("NODE_ENV","test");vi.stubEnv("EMAIL_DELIVERY_MODE","disabled");vi.stubEnv("GOOGLE_CLIENT_ID","");vi.stubEnv("GOOGLE_CLIENT_SECRET","");
 for(const path of ["sign-up/email","send-verification-email","request-password-reset"]){
  const response=await POST(new Request(`http://localhost:3000/api/auth/${path}`,{method:"POST",headers:{origin:"http://localhost:3000"}}));
  expect(response.status).toBe(503);expect(await response.json()).toMatchObject({code:"EMAIL_DELIVERY_NOT_CONFIGURED"});
 }
 const rejected=await POST(new Request("http://localhost:3000/api/auth/sign-up/email",{method:"POST",headers:{origin:"https://foreign.example"}}));expect(rejected.status).toBe(403);expect(fixture.auth).not.toHaveBeenCalled();
});
