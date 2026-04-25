import { CheckCircle2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VerifiedBadgeProps {
  isVerified?: boolean;
  size?: number;
  showTooltip?: boolean;
}

export function VerifiedBadge({ isVerified, size = 14, showTooltip = true }: VerifiedBadgeProps) {
  if (!isVerified) {
    if (!showTooltip) return null;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="h-4 w-4 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center cursor-help">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/20" />
            </div>
          </TooltipTrigger>
          <TooltipContent className="font-body text-[11px] bg-card border-border text-foreground p-2">
            <p className="font-bold mb-0.5">Verification Pending</p>
            <p className="text-muted-foreground">Complete 5 high-signal posts to unlock.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <CheckCircle2 
            size={size} 
            className="text-[#D1FF4A] drop-shadow-[0_0_4px_rgba(209,255,74,0.3)]" 
          />
        </TooltipTrigger>
        <TooltipContent className="font-body text-[11px] bg-[#D1FF4A] border-none text-black p-2">
          <p className="font-bold">Verified Pro</p>
          <p className="opacity-80">This freelancer is vetted for high-signal quality.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
