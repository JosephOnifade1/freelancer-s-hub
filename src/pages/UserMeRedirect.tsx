import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getUserProfile } from "@/lib/users";

const UserMeRedirect = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => (user ? getUserProfile(user.uid) : null),
    enabled: !!user && !loading,
  });

  useEffect(() => {
    if (!loading && user && (profile !== undefined)) {
      navigate(`/f/${profile?.username || user.uid}`);
    } else if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, profile, navigate]);

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
