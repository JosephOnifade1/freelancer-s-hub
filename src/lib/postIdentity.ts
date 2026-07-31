import type { PostData } from "@/components/PostCard";

export const getPostPath = (post: Pick<PostData, "id" | "communitySlug">) =>
  post.communitySlug ? `/b/${post.communitySlug}/p/${post.id}` : `/p/${post.id}`;

export const getAuthorHandle = (author: PostData["author"]) => {
  const handle = author?.username || author?.name?.replace(/\s+/g, "") || "Unknown";
  return `f/${handle}`;
};

export const getAuthorPath = (author: PostData["author"]) => {
  const identifier = author?.username || author?.uid;
  return identifier ? `/f/${identifier}` : "#";
};

export const getDestinationLabel = (post: Pick<PostData, "communitySlug" | "author">) =>
  post.communitySlug ? `b/${post.communitySlug}` : getAuthorHandle(post.author);

export const getDestinationPath = (post: Pick<PostData, "communitySlug" | "author">) =>
  post.communitySlug ? `/b/${post.communitySlug}` : getAuthorPath(post.author);

export const isProfilePost = (post: Pick<PostData, "communitySlug">) => !post.communitySlug;
