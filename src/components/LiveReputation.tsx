import { useQuery } from "@tanstack/react-query";
import { getUserProfile } from "@/lib/users";

interface LiveReputationProps {
  uid?: string;
  fallback: number;
}

export function LiveReputation({ uid, fallback }: LiveReputationProps) {
  const { data: profile } = useQuery({
    queryKey: ['profile', uid],
    queryFn: () => uid ? getUserProfile(uid) : null,
    enabled: !!uid,
    staleTime: 30000, // Cache for 30s to avoid spamming
  });

  return <>⚡ {profile?.reputation ?? fallback ?? 0}</>;
}
