// @vitest-environment node
import {describe,it,expect,vi} from "vitest";
import {NextRequest} from "next/server";
import {proxy} from "../proxy";
const request=(path:string,cookie?:string)=>new NextRequest("http://localhost"+path,{headers:cookie?{cookie}:undefined});
describe("Better Auth optimistic proxy (not an authorization boundary)",()=>{
 it("redirects missing cookie preserving return destination",async()=>{const response=await proxy(request("/settings?tab=security"));expect(response.status).toBe(307);expect(response.headers.get("location")).toContain("from=%2Fsettings%3Ftab%3Dsecurity");});
 it("allows cookie presence to reach server validation",async()=>expect((await proxy(request("/settings","borynx.session_token=not-yet-validated"))).status).toBe(200));
 it.each(["/","/login","/signup","/l","/api/auth/callback/google"])("public/auth path remains reachable %s",async path=>expect((await proxy(request(path))).status).toBe(200));
 it("rejects untrusted app mutation origins before feature handling",async()=>expect((await proxy(new NextRequest("http://localhost/api/profile/me",{method:"POST",headers:{origin:"https://evil.invalid"}}))).status).toBe(403));
});
