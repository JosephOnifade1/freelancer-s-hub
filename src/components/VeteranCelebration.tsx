import { useEffect } from "react";
import confetti from "canvas-confetti";
import { useAuth } from "@/hooks/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, isVeteran } from "@/lib/users";
import { markVeteranCelebrationSeen } from "@/lib/profile-client";
import { toast } from "sonner";

export function VeteranCelebration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user?.uid ? getUserProfile(user.uid) : null,
    enabled: !!user?.uid,
  });

  const { mutate: markCelebrated } = useMutation({
    mutationFn: async () => {
      // Phase 2C: written to Neon. The uid argument is gone — the server writes the
      // session's own row, so this cannot mark somebody else's celebration as seen.
      await markVeteranCelebrationSeen();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.uid] });
    }
  });

  useEffect(() => {
    if (profile && isVeteran(profile.reputation || 0) && !profile.hasSeenVeteranCelebration) {
      // Trigger Confetti
      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: ReturnType<typeof setInterval> = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        // use lime and white colors
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#D1FF4A', '#FFFFFF'] });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#D1FF4A', '#FFFFFF'] });
      }, 250);

      toast("Elite status unlocked: you are now a Veteran Freelancer.", {
        description: "Your reputation has surpassed 5,000. Enjoy your new elite aura.",
        duration: 10000,
      });

      markCelebrated();
      
      return () => clearInterval(interval);
    }
  }, [profile, user, markCelebrated]);

  return null;
}
