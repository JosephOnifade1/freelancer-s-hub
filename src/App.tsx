import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";

// Page imports are route-level lazy chunks. This keeps editor-heavy and
// feature-specific pages out of the first JavaScript payload.
import { lazy, Suspense, type CSSProperties } from "react";

const Index = lazy(() => import("./views/Index"));
const Leaderboard = lazy(() => import("./views/Leaderboard"));
const MyReports = lazy(() => import("./views/MyReports"));
const NewFeed = lazy(() => import("./views/NewFeed"));
const Popular = lazy(() => import("./views/Popular"));
const TagFeed = lazy(() => import("./views/TagFeed"));
const Communities = lazy(() => import("./views/Communities"));
const Bookmarks = lazy(() => import("./views/Bookmarks"));
const Achievements = lazy(() => import("./views/Achievements"));
const ProfileDetail = lazy(() => import("./views/Profile"));
const UserMeRedirect = lazy(() => import("./views/UserMeRedirect"));
const LeadsBoard = lazy(() => import("./views/LeadsBoard"));
const Pipeline = lazy(() => import("./views/Pipeline"));
const Applications = lazy(() => import("./views/Applications"));
const Notifications = lazy(() => import("./views/Notifications"));
const Privacy = lazy(() => import("./views/Privacy"));
const Terms = lazy(() => import("./views/Terms"));
const Admin = lazy(() => import("./views/Admin"));
const LeadDetail = lazy(() => import("./views/LeadDetail"));
const CreateLead = lazy(() => import("./views/CreateLead"));
const Settings = lazy(() => import("./views/Settings"));
const CreatePost = lazy(() => import("./views/CreatePost"));
const PostDetail = lazy(() => import("./views/PostDetail"));
const CommunityDetail = lazy(() => import("./views/CommunityDetail"));
const NotFound = lazy(() => import("./views/NotFound"));
const Login = lazy(() => import("./views/Login"));
const Signup = lazy(() => import("./views/Signup"));
const ForgotPassword = lazy(() => import("./views/ForgotPassword"));
const ResetPassword = lazy(() => import("./views/ResetPassword"));
const Onboarding = lazy(() => import("./views/Onboarding"));
const Landing = lazy(() => import("./views/Landing"));
const Drafts = lazy(() => import("./views/Drafts"));

// Component imports
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppLayout } from "./components/AppLayout";
import { ComingSoon } from "./components/ComingSoon";

import { useAuth } from "./hooks/auth-context";
import { AuthProvider } from "./hooks/useAuth";

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

              {/* Read-only public content. Writes remain behind ProtectedRoute and RLS. */}
              <Route path="/new"          element={<NewFeed />} />
              <Route path="/following"    element={<ProtectedRoute><Navigate to="/?feed=following" replace /></ProtectedRoute>} />
              <Route path="/popular"      element={<Popular />} />
              <Route path="/leaderboard"  element={<Leaderboard />} />
              <Route path="/submit"       element={<ProtectedRoute><CreatePost /></ProtectedRoute>} />
              <Route path="/tag/:tagName" element={<TagFeed />} />

              {/* Public spaces, posts, profiles and real marketplace */}
              <Route path="/communities"        element={<Communities />} />
              <Route path="/b"                  element={<Navigate to="/communities" replace />} />
              <Route path="/b/:slug"            element={<CommunityDetail />} />
              <Route path="/b/:slug/p/:id"      element={<PostDetail />} />
              <Route path="/p"      element={<Navigate to="/" replace />} />
              <Route path="/p/:id"  element={<PostDetail />} />
              <Route path="/f"      element={<Navigate to="/" replace />} />
              <Route path="/f/me"   element={<ProtectedRoute><UserMeRedirect /></ProtectedRoute>} />
              <Route path="/f/:username" element={<ErrorBoundary><ProfileDetail /></ErrorBoundary>} />
              <Route path="/u"      element={<Navigate to="/" replace />} />
              <Route path="/u/:username" element={<LegacyProfileRedirect />} />
              <Route path="/l"         element={<LeadsBoard />} />
              <Route path="/l/post"    element={<ProtectedRoute><CreateLead /></ProtectedRoute>} />
              <Route path="/l/:leadId" element={<LeadDetail />} />
              <Route path="/pipeline"  element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
              <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

              {/* ── Authenticated: personal pages ───────────────────────── */}
              <Route path="/bookmarks"    element={<ProtectedRoute><Bookmarks /></ProtectedRoute>} />
              <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
              <Route path="/my-reports"   element={<ProtectedRoute><MyReports /></ProtectedRoute>} />
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
