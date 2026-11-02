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
        <button className="flex items-center gap-2 rounded-full bg-transparent border border-border px-4 py-1.5 font-body text-xs font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground hover:bg-muted transition-all">
          <SortIcon className="h-3.5 w-3.5" />
          <span className="capitalize">{value}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-32 bg-card border-border font-body shadow-md rounded-xl"
      >
        <DropdownMenuItem 
          onClick={() => onChange("best")}
          className={cn(
            "cursor-pointer flex items-center gap-2 py-2 px-3 rounded-md transition-colors", 
            value === "best" 
              ? "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary" 
              : "text-foreground hover:bg-muted focus:bg-muted"
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
              ? "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary" 
              : "text-foreground hover:bg-muted focus:bg-muted"
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
              ? "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary" 
              : "text-foreground hover:bg-muted focus:bg-muted"
          )}
        >
          <Clock className="h-4 w-4" />
          <span>New</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
