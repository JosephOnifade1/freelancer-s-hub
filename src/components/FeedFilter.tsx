import { Flame, Clock, TrendingUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SortType } from "@/lib/sorting";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FeedFilterProps {
  value: SortType;
  onChange: (value: SortType) => void;
}

export function FeedFilter({ value, onChange }: FeedFilterProps) {
  const SortIcon = value === "hot" ? Flame : value === "new" ? Clock : TrendingUp;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full bg-transparent border border-[var(--border-main)] px-4 py-1.5 font-body text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] transition-all">
          <SortIcon className="h-3.5 w-3.5" />
          <span className="capitalize">{value}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-32 bg-[var(--bg-surface)] border-[var(--border-main)] font-body shadow-md rounded-xl"
      >
        <DropdownMenuItem 
          onClick={() => onChange("best")}
          className={cn(
            "cursor-pointer flex items-center gap-2 py-2 px-3 rounded-md transition-colors", 
            value === "best" 
              ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] focus:bg-[var(--brand-primary)]/10 focus:text-[var(--brand-primary)]" 
              : "text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] focus:bg-[var(--bg-surface-hover)]"
          )}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Best</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => onChange("hot")}
          className={cn(
            "cursor-pointer flex items-center gap-2 py-2 px-3 rounded-md transition-colors", 
            value === "hot" 
              ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] focus:bg-[var(--brand-primary)]/10 focus:text-[var(--brand-primary)]" 
              : "text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] focus:bg-[var(--bg-surface-hover)]"
          )}
        >
          <Flame className="h-4 w-4" />
          <span>Hot</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => onChange("new")}
          className={cn(
            "cursor-pointer flex items-center gap-2 py-2 px-3 rounded-md transition-colors", 
            value === "new" 
              ? "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] focus:bg-[var(--brand-primary)]/10 focus:text-[var(--brand-primary)]" 
              : "text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] focus:bg-[var(--bg-surface-hover)]"
          )}
        >
          <Clock className="h-4 w-4" />
          <span>New</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
