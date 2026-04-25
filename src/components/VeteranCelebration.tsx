import { useEffect } from "react";
import confetti from "canvas-confetti";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, isVeteran } from "@/lib/users";
import { ref, update } from "firebase/database";
import { database } from "@/lib/firebase";
import { toast } from "sonner";

export function VeteranCelebration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user?.uid ? getUserProfile(user.uid) : null,
    enabled: !!user?.uid,
  });

  const markCelebrated = useMutation({
    mutationFn: async (uid: string) => {
      await update(ref(database, `users/${uid}`), { 
        hasSeenVeteranCelebration: true 
      });
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

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        // use violet and lime colors
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#6366F1', '#D1FF4A'] });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#6366F1', '#D1FF4A'] });
      }, 250);

      toast("🏆 ELITE STATUS UNLOCKED: You are now a Veteran Freelancer!", {
        description: "Your reputation has surpassed 5,000. Enjoy your new elite aura.",
        duration: 10000,
      });

      markCelebrated.mutate(user!.uid);
      
      return () => clearInterval(interval);
    }
  }, [profile, user]);

  return null;
}
