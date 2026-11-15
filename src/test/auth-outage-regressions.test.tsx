import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
const fixture=vi.hoisted(()=>({retry:vi.fn(),replace:vi.fn()}));
vi.mock("@/lib/auth-client",()=>({authClient:{useSession:()=>({data:null,isPending:false,error:{message:"unavailable"},refetch:fixture.retry}),signOut:vi.fn()}}));
vi.mock("@/lib/profile-provisioning",()=>({provisionProfileOnServer:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({replace:fixture.replace}),usePathname:()=>"/settings"}));
import {AuthProvider} from "@/hooks/useAuth";
import {AuthGate} from "@/components/AuthGate";
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("keeps public pages usable on auth outage, but blocks private content and allows retry",()=>{
 render(<QueryClientProvider client={new QueryClient()}><AuthProvider><p>Public landing content</p><AuthGate><p>Private settings content</p></AuthGate></AuthProvider></QueryClientProvider>);
 expect(screen.getByText("Public landing content")).toBeInTheDocument();expect(screen.queryByText("Private settings content")).toBeNull();expect(fixture.replace).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole("button",{name:"Retry authentication"}));expect(fixture.retry).toHaveBeenCalledTimes(1);
});
