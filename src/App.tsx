import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { SidebarProvider } from "./components/ui/sidebar.tsx";
import { ComingSoon } from "./components/ComingSoon.tsx";
import { AppLayout } from "./components/AppLayout.tsx";

import { useAuth, AuthProvider } from "./hooks/useAuth.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});
const RootRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  return user ? <Index /> : <Landing />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <SidebarProvider style={{ "--sidebar-top": "3.5rem" } as React.CSSProperties}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/new" element={<ProtectedRoute><NewFeed /></ProtectedRoute>} />
              <Route path="/following" element={<ProtectedRoute><Following /></ProtectedRoute>} />
              
              {/* Specialized Borynx Routing */}
              <Route path="/b" element={<Navigate to="/communities" replace />} />
              <Route path="/b/:slug/p/:id" element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />
              <Route path="/b/:slug" element={<ProtectedRoute><CommunityDetail /></ProtectedRoute>} />
              <Route path="/p" element={<Navigate to="/" replace />} />
              <Route path="/p/:id" element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />

              {/* Freelancer Profile Routes — canonical /f/ prefix */}
              <Route path="/f" element={<Navigate to="/" replace />} />
              <Route path="/f/me" element={<UserMeRedirect />} />
              <Route path="/f/:uid" element={<ProtectedRoute><ErrorBoundary><ProfileDetail /></ErrorBoundary></ProtectedRoute>} />

              {/* Legacy /u/ redirects — keep old links working */}
              <Route path="/u" element={<Navigate to="/" replace />} />
              <Route path="/u/me" element={<UserMeRedirect />} />
              <Route path="/u/:uid" element={<ProtectedRoute><ErrorBoundary><ProfileDetail /></ErrorBoundary></ProtectedRoute>} />

              <Route path="/l" element={<ProtectedRoute><LeadsBoard /></ProtectedRoute>} />
              <Route path="/l/post" element={<ProtectedRoute><CreateLead /></ProtectedRoute>} />
              <Route path="/l/:leadId" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
              
              <Route path="/tag/:tagName" element={<ProtectedRoute><TagFeed /></ProtectedRoute>} />
              <Route path="/communities" element={<ProtectedRoute><Communities /></ProtectedRoute>} />
              <Route path="/bookmarks" element={<ProtectedRoute><Bookmarks /></ProtectedRoute>} />
              <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/submit" element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
              
              {/* Coming Soon Routes */}
              <Route path="/drafts" element={<ProtectedRoute><AppLayout><ComingSoon title="Drafts" description="Your post drafts will appear here soon." backTo="/" /></AppLayout></ProtectedRoute>} />
              <Route path="/premium" element={<ProtectedRoute><AppLayout><ComingSoon title="Premium" description="Borynx Premium features are currently in development." backTo="/" /></AppLayout></ProtectedRoute>} />
              <Route path="/pricing" element={<div className="min-h-screen bg-background flex flex-col items-center justify-center p-4"><ComingSoon title="Pricing" description="Our pricing plans will be available soon. Check back later!" backTo="/" /></div>} />
              <Route path="/status" element={<div className="min-h-screen bg-background flex flex-col items-center justify-center p-4"><ComingSoon title="System Status" description="Detailed system status and uptime monitoring is being built." backTo="/" /></div>} />
              <Route path="/privacy" element={<div className="min-h-screen bg-background flex flex-col items-center justify-center p-4"><ComingSoon title="Privacy Policy" description="Our privacy policy is currently being drafted." backTo="/" /></div>} />
              <Route path="/terms" element={<div className="min-h-screen bg-background flex flex-col items-center justify-center p-4"><ComingSoon title="Terms of Service" description="Our terms of service are currently being drafted." backTo="/" /></div>} />

              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SidebarProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
