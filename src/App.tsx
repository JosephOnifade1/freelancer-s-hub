import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar.tsx";

// Page imports
import Index from "./pages/Index.tsx";
import NewFeed from "./pages/NewFeed.tsx";
import Following from "./pages/Following.tsx";
import TagFeed from "./pages/TagFeed.tsx";
import Communities from "./pages/Communities.tsx";
import Bookmarks from "./pages/Bookmarks.tsx";
import Achievements from "./pages/Achievements.tsx";
import ProfileDetail from "./pages/Profile.tsx";
import UserMeRedirect from "./pages/UserMeRedirect.tsx";
import LeadsBoard from "./pages/LeadsBoard.tsx";
import LeadDetail from "./pages/LeadDetail.tsx";
import CreateLead from "./pages/CreateLead.tsx";
import Settings from "./pages/Settings.tsx";
import CreatePost from "./pages/CreatePost.tsx";
import PostDetail from "./pages/PostDetail.tsx";
import CommunityDetail from "./pages/CommunityDetail.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Landing from "./pages/Landing.tsx";

// Component imports
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { AppLayout } from "./components/AppLayout.tsx";
import { ComingSoon } from "./components/ComingSoon.tsx";

import { useAuth, AuthProvider } from "./hooks/useAuth.tsx";

// ─── Query Client ───────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Root Route: authenticated → feed, anonymous → landing ──────────────────
const RootRoute = () => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse h-8 w-8 rounded-full bg-primary/30" />
      </div>
    );
  }
  return user ? <Index /> : <Landing />;
};

// ─── Coming-Soon wrapper using AppLayout (for authenticated pages) ──────────
const ComingSoonPage = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <AppLayout>
    <ComingSoon title={title} description={description} backTo="/" />
  </AppLayout>
);

// ─── Standalone Coming-Soon (no sidebar, for public/marketing pages) ─────────
const StandaloneComingSoon = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
    <ComingSoon title={title} description={description} backTo="/" />
  </div>
);

// ─── App ─────────────────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <SidebarProvider style={{ "--sidebar-top": "3.5rem" } as React.CSSProperties}>
          <BrowserRouter>
            <Routes>

              {/* ── Public routes ───────────────────────────────────────── */}
              <Route path="/" element={<RootRoute />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Public marketing / info pages */}
              <Route path="/pricing" element={<StandaloneComingSoon title="Pricing" description="Our pricing plans will be available soon." />} />
              <Route path="/status"  element={<StandaloneComingSoon title="System Status" description="Detailed uptime monitoring is being built." />} />
              <Route path="/privacy" element={<StandaloneComingSoon title="Privacy Policy" description="Our privacy policy is currently being drafted." />} />
              <Route path="/terms"   element={<StandaloneComingSoon title="Terms of Service" description="Our terms of service are currently being drafted." />} />

              {/* ── Authenticated: feed views ───────────────────────────── */}
              <Route path="/new"       element={<ProtectedRoute><NewFeed /></ProtectedRoute>} />
              <Route path="/following" element={<ProtectedRoute><Following /></ProtectedRoute>} />
              <Route path="/submit"    element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
              <Route path="/tag/:tagName" element={<ProtectedRoute><TagFeed /></ProtectedRoute>} />

              {/* ── Authenticated: Borynx Spaces (communities) ─────────── */}
              {/* /b is not a real standalone page — redirect to the communities list */}
              <Route path="/communities"        element={<ProtectedRoute><Communities /></ProtectedRoute>} />
              <Route path="/b"                  element={<Navigate to="/communities" replace />} />
              <Route path="/b/:slug"            element={<ProtectedRoute><CommunityDetail /></ProtectedRoute>} />
              <Route path="/b/:slug/p/:id"      element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />

              {/* ── Authenticated: Posts ────────────────────────────────── */}
              {/* /p is not a real standalone page — redirect home */}
              <Route path="/p"      element={<Navigate to="/" replace />} />
              <Route path="/p/:id"  element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />

              {/* ── Authenticated: Freelancer profiles ─────────────────── */}
              {/* /f and /u are prefix namespaces, not pages themselves */}
              <Route path="/f"      element={<Navigate to="/" replace />} />
              <Route path="/f/me"   element={<UserMeRedirect />} />
              <Route path="/f/:uid" element={<ProtectedRoute><ErrorBoundary><ProfileDetail /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/u"      element={<Navigate to="/" replace />} />
              <Route path="/u/me"   element={<UserMeRedirect />} />
              <Route path="/u/:uid" element={<ProtectedRoute><ErrorBoundary><ProfileDetail /></ErrorBoundary></ProtectedRoute>} />

              {/* ── Authenticated: Leads ────────────────────────────────── */}
              <Route path="/l"         element={<ProtectedRoute><LeadsBoard /></ProtectedRoute>} />
              <Route path="/l/post"    element={<ProtectedRoute><CreateLead /></ProtectedRoute>} />
              <Route path="/l/:leadId" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />

              {/* ── Authenticated: personal pages ───────────────────────── */}
              <Route path="/bookmarks"    element={<ProtectedRoute><Bookmarks /></ProtectedRoute>} />
              <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
              <Route path="/settings"     element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              {/* ── Authenticated: coming-soon stubs ───────────────────── */}
              <Route path="/drafts"  element={<ProtectedRoute><ComingSoonPage title="Drafts" description="Your post drafts will appear here soon." /></ProtectedRoute>} />
              <Route path="/premium" element={<ProtectedRoute><ComingSoonPage title="Premium" description="Borynx Premium is currently in development." /></ProtectedRoute>} />

              {/* ── 404 catch-all ────────────────────────────────────────── */}
              <Route path="*" element={<NotFound />} />

            </Routes>
          </BrowserRouter>
        </SidebarProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
