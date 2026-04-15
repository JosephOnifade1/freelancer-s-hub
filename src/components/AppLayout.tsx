import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/80 backdrop-blur-md px-4">
            <SidebarTrigger className="mr-4" />
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-sm font-semibold text-foreground">
                Soloboard
              </h1>
              <span className="rounded-full bg-primary/15 px-2 py-0.5 font-body text-[10px] font-medium text-primary">
                Beta
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
