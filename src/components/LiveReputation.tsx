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

  const reputation = profile?.reputation ?? fallback ?? 0;
  const isHighRep = reputation >= 1000;

  return (
    <span className="inline-flex items-center gap-1">
      <span className={`${isHighRep ? "text-[#D1FF4A] drop-shadow-[0_0_5px_rgba(209,255,74,0.6)] animate-pulse" : "text-primary"} translate-y-[-1px]`}>
        ⚡
      </span>
      {reputation.toLocaleString()}
    </span>
  );
}
