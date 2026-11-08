import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar.tsx";

// Page imports are route-level lazy chunks. This keeps editor-heavy and
// feature-specific pages out of the first JavaScript payload.
import { lazy, Suspense, type CSSProperties } from "react";

const Index = lazy(() => import("./pages/Index.tsx"));
const NewFeed = lazy(() => import("./pages/NewFeed.tsx"));
const Following = lazy(() => import("./pages/Following.tsx"));
const Popular = lazy(() => import("./pages/Popular.tsx"));
const TagFeed = lazy(() => import("./pages/TagFeed.tsx"));
const Communities = lazy(() => import("./pages/Communities.tsx"));
const Bookmarks = lazy(() => import("./pages/Bookmarks.tsx"));
const Achievements = lazy(() => import("./pages/Achievements.tsx"));
const ProfileDetail = lazy(() => import("./pages/Profile.tsx"));
const UserMeRedirect = lazy(() => import("./pages/UserMeRedirect.tsx"));
const LeadsBoard = lazy(() => import("./pages/LeadsBoard.tsx"));
const Applications = lazy(() => import("./pages/Applications.tsx"));
const Notifications = lazy(() => import("./pages/Notifications.tsx"));
const Privacy = lazy(() => import("./pages/Privacy.tsx"));
const Terms = lazy(() => import("./pages/Terms.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const LeadDetail = lazy(() => import("./pages/LeadDetail.tsx"));
const CreateLead = lazy(() => import("./pages/CreateLead.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const CreatePost = lazy(() => import("./pages/CreatePost.tsx"));
const PostDetail = lazy(() => import("./pages/PostDetail.tsx"));
const CommunityDetail = lazy(() => import("./pages/CommunityDetail.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const Signup = lazy(() => import("./pages/Signup.tsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const Landing = lazy(() => import("./pages/Landing.tsx"));
const Drafts = lazy(() => import("./pages/Drafts.tsx"));

// Component imports
import { ProtectedRoute } from "./components/ProtectedRoute.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { AppLayout } from "./components/AppLayout.tsx";
import { ComingSoon } from "./components/ComingSoon.tsx";

import { useAuth } from "./hooks/auth-context.ts";
import { AuthProvider } from "./hooks/useAuth.tsx";

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
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center" aria-label="Loading page">
    <div className="animate-pulse h-8 w-8 rounded-full bg-brand/30" />
  </div>
);

// ─── Root Route: authenticated → feed, anonymous → landing ──────────────────
const RootRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
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
const LegacyProfileRedirect = () => {
  const { username } = useParams();
  return <Navigate to={`/f/${username}`} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <SidebarProvider style={{ "--sidebar-top": "3.5rem" } as CSSProperties}>
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
            <Routes>

              {/* ── Public routes ───────────────────────────────────────── */}
              <Route path="/" element={<RootRoute />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

              {/* Public marketing / info pages */}
              <Route path="/pricing" element={<StandaloneComingSoon title="Pricing" description="Our pricing plans will be available soon." />} />
              <Route path="/status"  element={<StandaloneComingSoon title="System Status" description="Detailed uptime monitoring is being built." />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms"   element={<Terms />} />

              {/* ── Authenticated: feed views ───────────────────────────── */}
              <Route path="/new"          element={<ProtectedRoute><NewFeed /></ProtectedRoute>} />
              <Route path="/following"    element={<ProtectedRoute><Following /></ProtectedRoute>} />
              <Route path="/popular"      element={<ProtectedRoute><Popular /></ProtectedRoute>} />
              <Route path="/submit"       element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
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
              <Route path="/f/:username" element={<ProtectedRoute><ErrorBoundary><ProfileDetail /></ErrorBoundary></ProtectedRoute>} />
              {/* legacy /u/... links keep working */}
              <Route path="/u"      element={<Navigate to="/" replace />} />
              <Route path="/u/:username" element={<LegacyProfileRedirect />} />

              {/* ── Authenticated: Leads ────────────────────────────────── */}
              <Route path="/l"         element={<ProtectedRoute><LeadsBoard /></ProtectedRoute>} />
              <Route path="/l/post"    element={<ProtectedRoute><CreateLead /></ProtectedRoute>} />
              <Route path="/l/:leadId" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
              <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

              {/* ── Authenticated: personal pages ───────────────────────── */}
              <Route path="/bookmarks"    element={<ProtectedRoute><Bookmarks /></ProtectedRoute>} />
              <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
              <Route path="/settings"     element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              {/* ── Authenticated: coming-soon stubs ───────────────────── */}
              <Route path="/drafts"  element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
              <Route path="/premium" element={<ProtectedRoute><ComingSoonPage title="Premium" description="Borynx Premium is currently in development." /></ProtectedRoute>} />

              {/* ── 404 catch-all ────────────────────────────────────────── */}
              <Route path="*" element={<NotFound />} />

            </Routes>
            </Suspense>
          </BrowserRouter>
        </SidebarProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
