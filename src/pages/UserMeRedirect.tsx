import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const UserMeRedirect = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigate(`/f/${user.uid}`);
      } else {
        navigate("/login");
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-primary/20" />
        <p className="text-sm text-muted-foreground font-body">Redirecting to your profile...</p>
      </div>
    </div>
  );
};

export default UserMeRedirect;
