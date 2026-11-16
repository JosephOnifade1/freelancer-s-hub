import { ShieldCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VerifiedBadgeProps {
  isVerified?: boolean;
  size?: number;
  /** kept for call-site compatibility */
  showTooltip?: boolean;
}

export function VerifiedBadge({ isVerified, size = 14 }: VerifiedBadgeProps) {
  if (!isVerified) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center text-verdigris" title="Verified Pro" aria-label="Verified Pro">
            <ShieldCheck 
              size={size} 
              strokeWidth={2.4}
              className="text-verdigris" 
            />
          </span>
        </TooltipTrigger>
        <TooltipContent className="font-body text-[11px] bg-primary border-none text-primary-foreground p-2">
          <p className="font-bold">Verified Pro</p>
          <p className="opacity-80">This freelancer is vetted for high-signal quality.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
