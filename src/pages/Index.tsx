import { useState } from "react";
import { Flame, Clock, Users } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { AppLayout } from "@/components/AppLayout";
import { mockPosts } from "@/data/mockPosts";

type SortTab = "hot" | "new" | "following";

const tabs: { id: SortTab; label: string; icon: React.ElementType }[] = [
  { id: "hot", label: "Hot", icon: Flame },
  { id: "new", label: "New", icon: Clock },
  { id: "following", label: "Following", icon: Users },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<SortTab>("hot");

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-6">
          {/* Main Feed */}
          <div className="flex-1 min-w-0">
            {/* Sort Tabs */}
            <div className="mb-5 flex items-center gap-1 rounded-xl border border-border bg-card p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 font-body text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Posts */}
            <div className="space-y-3">
              {mockPosts.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} />
              ))}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-20">
              <FeedSidebar />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
