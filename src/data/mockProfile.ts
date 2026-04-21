export const mockProfile = {
  username: "marcelo_dev",
  initial: "M",
  bio: "Fintech dashboards & React specialist. Helping solo devs raise their rates.",
  location: "Lisbon, Portugal",
  website: "marcelo.dev",
  joined: "2024",
  status: "Open to work",
  skills: ["React", "TypeScript", "UI Design", "Figma", "Copywriting"],
  reputation: 2340,
  followers: 847,
  following: 124,
};

export type UserComment = {
  id: string;
  postId: string;
  postTitle: string;
  body: string;
  score: number;
  timeAgo: string;
};

export const mockUserComments: UserComment[] = [
  {
    id: "c1",
    postId: "3",
    postTitle: "The proposal template that landed me 8 clients this quarter",
    body: "This is gold. The 'why me' section reframed how I think about positioning — stopped listing skills, started naming outcomes. Already adapted it for my next pitch.",
    score: 48,
    timeAgo: "2h ago",
  },
  {
    id: "c2",
    postId: "2",
    postTitle: "How do you handle clients who ghost after the discovery call?",
    body: "I send one follow-up after 3 days, another after a week, then move on. Ghosting usually means budget or internal politics — rarely about you. Don't take it personally.",
    score: 31,
    timeAgo: "6h ago",
  },
  {
    id: "c3",
    postId: "5",
    postTitle: "Stop undercharging: A framework for value-based pricing",
    body: "Value-based works best when you can quantify the outcome. For dashboards, I tie the price to the hours saved per week × the team's blended rate. Easy sell.",
    score: 27,
    timeAgo: "1d ago",
  },
  {
    id: "c4",
    postId: "6",
    postTitle: "Best invoicing tools for international freelancers?",
    body: "Wise + a simple Notion tracker covers 90% of it. For EU VAT specifically, Octobat has been bulletproof for me.",
    score: 19,
    timeAgo: "1d ago",
  },
  {
    id: "c5",
    postId: "4",
    postTitle: "🏆 Weekly Thread: Share your biggest win this week",
    body: "Closed a 6-month retainer at my new rate. First time I didn't flinch when saying the number out loud.",
    score: 64,
    timeAgo: "2d ago",
  },
  {
    id: "c6",
    postId: "1",
    postTitle: "I tripled my freelance rate in 6 months — here's exactly how",
    body: "Author here — happy to answer specifics on the positioning shift. The biggest unlock was niching down hard enough that referrals started coming pre-qualified.",
    score: 92,
    timeAgo: "3h ago",
  },
];
