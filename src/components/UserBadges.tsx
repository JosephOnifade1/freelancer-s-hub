import { Sparkles, Trophy, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getUserResourcesCount } from "@/lib/users";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UserBadgesProps {
  uid: string;
}

export function UserBadges({ uid }: UserBadgesProps) {
  const { data: resourceCount = 0 } = useQuery({
    queryKey: ['user-resources-count', uid],
    queryFn: () => getUserResourcesCount(uid),
    enabled: !!uid
  });

  const badges = [
    {
      id: 'staff',
      label: 'Staff',
      icon: Shield,
      color: 'text-[var(--brand-primary)]',
      bgColor: 'bg-[var(--brand-primary)]/10',
      description: 'A verified staff member of Soloboard.',
      active: false
    },
    {
      id: 'early_adopter',
      label: 'Early Adopter',
      icon: Sparkles,
      color: 'text-[var(--brand-accent)]',
      bgColor: 'bg-[var(--brand-accent)]/10',
      description: 'An early adopter of Soloboard.',
      active: true
    },
    {
      id: 'resource-king',
      label: 'Resource King',
      icon: Trophy,
      color: 'text-[#D1FF4A]',
      bgColor: 'bg-[#D1FF4A]/10',
      description: 'Shared over 10 high-signal resources with the community.',
      active: resourceCount > 10
    }
  ];

  const activeBadges = badges.filter(b => b.active);

  if (activeBadges.length === 0) return null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 mt-1">
        {activeBadges.map((badge) => (
          <Tooltip key={badge.id}>
            <TooltipTrigger asChild>
              <div className={`flex items-center justify-center p-1.5 rounded-md ${badge.bgColor} cursor-help transition-transform hover:scale-110`}>
                <badge.icon size={14} className={badge.color} />
              </div>
            </TooltipTrigger>
            <TooltipContent className="font-body text-[11px] bg-card border-border text-foreground p-2">
              <p className="font-bold mb-0.5">{badge.label}</p>
              <p className="text-muted-foreground">{badge.description}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
