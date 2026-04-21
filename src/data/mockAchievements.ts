import { Trophy, Flame, MessageSquare, Star, Calendar, BookOpen, Heart, Zap, type LucideIcon } from "lucide-react";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  unlocked: boolean;
};

export const achievements: Achievement[] = [
  { id: "first-post", name: "First Post", description: "Publish your very first post.", icon: Flame, unlocked: true },
  { id: "rep-100", name: "Rising Voice", description: "Reach 100 reputation points.", icon: Zap, unlocked: true },
  { id: "helper", name: "Helper", description: "Get 10 upvotes on comments.", icon: Heart, unlocked: true },
  { id: "rep-1000", name: "Trusted Voice", description: "Reach 1,000 reputation.", icon: Star, unlocked: false },
  { id: "streak-30", name: "Consistent", description: "Post 30 days in a row.", icon: Calendar, unlocked: false },
  { id: "resources-5", name: "Generous", description: "Share 5 resource posts.", icon: BookOpen, unlocked: false },
  { id: "veteran", name: "Veteran Freelancer", description: "Reach 5,000 reputation.", icon: Trophy, unlocked: false },
  { id: "convo-starter", name: "Conversation Starter", description: "Get 50 comments on a single post.", icon: MessageSquare, unlocked: false },
];
