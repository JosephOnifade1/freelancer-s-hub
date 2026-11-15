// @vitest-environment node
import {beforeEach,describe,it,expect,vi} from "vitest";
const state=vi.hoisted(()=>({configured:true,session:null as null|{user:{id:string;email:string;name:string;emailVerified:boolean}},error:false}));
vi.mock("@/server/auth",()=>({getAuth:()=>({api:{getSession:async()=>{if(state.error)throw Error("unavailable");return state.session;}}})}));
vi.mock("@/server/auth/config",()=>({authConfigured:()=>state.configured}));
vi.mock("next/headers",()=>({headers:async()=>new Headers()}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw Error("REDIRECT:"+path);}}));
import {getServerSession,requireServerSession} from "../lib/server-session";
beforeEach(()=>{state.configured=true;state.session=null;state.error=false;});
describe("Better Auth application session boundary (SDK mocked)",()=>{
 it("anonymous and unconfigured are null",async()=>{expect(await getServerSession()).toBeNull();state.configured=false;expect(await getServerSession()).toBeNull();});
 it("projects verified UUID identity only",async()=>{state.session={user:{id:"aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",email:"fixture@borynx.test",emailVerified:true,name:"Fixture"}};expect(await getServerSession()).toMatchObject({uid:state.session.user.id,emailVerified:true});});
 it("unverified user cannot become app actor",async()=>{state.session={user:{id:crypto.randomUUID(),email:"fixture@borynx.test",emailVerified:false,name:"Fixture"}};expect(await getServerSession()).toBeNull();});
 it("malformed user identity fails closed",async()=>{state.session={user:{id:"browser-id",email:"fixture@borynx.test",emailVerified:true,name:"Fixture"}};expect(await getServerSession()).toBeNull();});
 it("DB failure is not represented as a confirmed logout",async()=>{state.error=true;await expect(getServerSession()).rejects.toThrow("unavailable");});
 it("required session redirects using existing return contract",async()=>{await expect(requireServerSession("/settings")).rejects.toThrow("REDIRECT:/login?from=%2Fsettings");});
});
