import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen,waitFor} from "@testing-library/react";
const state=vi.hoisted(()=>({user:null as null|{id:string},loading:false,authError:false,delivery:"file"}));
vi.mock("@/hooks/auth-context",()=>({useAuth:()=>state}));
vi.mock("next/dynamic",()=>({default:(loader:()=>unknown)=>()=> <div>{String(loader).includes('views/Index')?"Signed-in feed":"Guest landing"}</div>}));
vi.mock("@/hooks/useAuthConfiguration",()=>({useAuthConfiguration:()=>({data:{emailDelivery:state.delivery}})}));
import Home from "@/app/page";
import {EmailDeliveryNotice} from "@/components/auth/EmailDeliveryNotice";
import {DemoAccounts} from "@/components/auth/DemoAccounts";
afterEach(()=>{cleanup();vi.unstubAllEnvs();vi.unstubAllGlobals();state.user=null;state.loading=false;state.authError=false;state.delivery="file";});
describe("guest homepage and honest email delivery",()=>{
 it("renders the landing for guests and the feed only for a signed-in viewer",()=>{
  const view=render(<Home/>);expect(screen.getByText("Guest landing")).toBeInTheDocument();
  state.user={id:"verified"};view.rerender(<Home/>);expect(screen.getByText("Signed-in feed")).toBeInTheDocument();
  state.authError=true;view.rerender(<Home/>);expect(screen.getByText("Guest landing")).toBeInTheDocument();
 });
 it("holds while resolving a session",()=>{state.loading=true;render(<Home/>);expect(screen.getByRole("status")).toHaveTextContent("Loading");});
 it("explains the private file outbox rather than claiming inbox delivery",()=>{render(<EmailDeliveryNotice/>);expect(screen.getByRole("status")).toHaveTextContent("no email is sent to your inbox");});
 it("explains disabled email without suggesting disabling verification",()=>{state.delivery="unavailable";render(<EmailDeliveryNotice/>);expect(screen.getByRole("status")).toHaveTextContent("need verification");});
});
describe("local demo discovery",()=>{
 it("shows setup instructions instead of silently disappearing",async()=>{
  vi.stubEnv("NODE_ENV","development");vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({status:"setup-required",accounts:[]})}));
  render(<DemoAccounts/>);expect(await screen.findByText(/Demo accounts are not available/)).toBeInTheDocument();
 });
 it("keeps missing seed accounts disabled and offers ready one-click logins",async()=>{
  vi.stubEnv("NODE_ENV","development");vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({status:"enabled",accounts:[{key:"client",name:"Demo Client",ready:true},{key:"admin",name:"Demo Admin",ready:false}]})}));
  render(<DemoAccounts/>);expect(await screen.findByRole("button",{name:"Demo Client"})).toBeEnabled();expect(screen.getByRole("button",{name:/Demo Admin/})).toBeDisabled();
 });
 it("explains failed discovery and can recheck",async()=>{
  vi.stubEnv("NODE_ENV","development");const fetcher=vi.fn().mockRejectedValue(Error());vi.stubGlobal("fetch",fetcher);
  render(<DemoAccounts/>);await screen.findByText(/Demo accounts are not available/);fireEvent.click(screen.getByRole("button",{name:"Recheck setup"}));await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
 });
 it("does not expose a demo section in production",()=>{vi.stubEnv("NODE_ENV","production");render(<DemoAccounts/>);expect(screen.queryByRole("region",{name:"Demo Accounts"})).toBeNull();});
});
