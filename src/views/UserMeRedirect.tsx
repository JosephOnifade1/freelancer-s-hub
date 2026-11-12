import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/auth-context";
import { useQuery } from "@tanstack/react-query";
import { getUserProfile } from "@/lib/users";

const UserMeRedirect = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => (user ? getUserProfile(user.uid) : null),
    enabled: !!user && !loading,
  });

  useEffect(() => {
    if (!loading && user && (profile !== undefined)) {
      router.push(`/f/${profile?.username || user.uid}`);
    } else if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, profile, router]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-muted" />
        <p className="text-sm text-muted-foreground font-body">Redirecting to your profile...</p>
      </div>
    </div>
  );
};

export default UserMeRedirect;
