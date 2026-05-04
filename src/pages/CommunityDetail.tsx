import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchCommunity } from "@/lib/communities";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { PostCard } from "@/components/PostCard";
import { fetchPosts } from "@/lib/posts";
import { useMemo } from "react";

const CommunityDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  
  const { data: community, isLoading: isCommunityLoading } = useQuery({
    queryKey: ['community', slug],
    queryFn: () => slug ? fetchCommunity(slug) : null,
    enabled: !!slug,
  });

  const { data: posts = [], isLoading: isPostsLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts
  });

  const communityPosts = useMemo(() => {
    if (!community) return [];
    // For now, filter by topic if the community has topics, 
    // or eventually filter by communityId when posts have them.
    return posts.filter(post => 
      post.tags?.some(tag => community.topics.includes(tag)) || 
      post.category === community.slug
    );
  }, [posts, community]);

  if (isCommunityLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-48 bg-muted rounded" />
            <div className="h-4 w-96 bg-muted rounded" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!community) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-6xl px-4 py-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Space Not Found</h1>
          <p className="text-muted-foreground">The B-Space "b/{slug}" doesn't exist yet.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <PageHeader 
          title={community.name}
          subtitle={community.description || `Welcome to the b/${community.slug} space.`}
        />
        
        <div className="space-y-4 mt-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
              Latest Posts in b/{community.slug}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {isPostsLoading ? (
            <div className="text-center py-10 text-muted-foreground">Loading posts...</div>
          ) : communityPosts.length === 0 ? (
            <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
              <p className="text-muted-foreground">No posts in this space yet. Be the first!</p>
            </div>
          ) : (
            communityPosts.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default CommunityDetail;
