import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/auth-context";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, authError, retrySession } = useAuth();
  const location = useLocation();

  if(authError)return <p role="alert">Cannot verify your session right now. <button onClick={retrySession}>Retry authentication</button></p>;
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
