import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PostDetail from "@/views/PostDetail";
import { fetchPostById, incrementPostViews, updatePost, softDeletePost } from "@/lib/posts";
import { toggleBookmark } from "@/lib/users";
import { addComment, fetchComments, type CommentData } from "@/lib/comments";
import { toast } from "sonner";
import type { PostData } from "@/components/PostCard";

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/VoteControls", () => ({
  VoteControls: ({ entityId, disabled }: { entityId?: string; disabled?: boolean }) =>
    <button type="button" aria-label={`Vote ${entityId}`} disabled={disabled}>Vote</button>,
}));
vi.mock("@/components/LiveReputation", () => ({ LiveReputation: () => <span /> }));
vi.mock("@/components/VerifiedBadge", () => ({ VerifiedBadge: () => <span /> }));
vi.mock("@/components/editor/Editor", () => ({ Editor: () => <div /> }));
vi.mock("@/components/editor/MarkdownRenderer", () => ({ MarkdownRenderer: ({ content }: { content: string }) => <div>{content}</div> }));
vi.mock("@/components/ReportDialog", () => ({ ReportDialog: () => null }));
vi.mock("@/components/PostAttachments", () => ({ PostAttachments: () => null }));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) =>
    <button type="button" onClick={onClick}>{children}</button>,
}));
const authState = vi.hoisted(() => ({ user: { uid: "viewer" } as { uid: string } | null }));
vi.mock("@/hooks/auth-context", () => ({ useAuth: () => ({ user: authState.user }) }));
vi.mock("@/lib/users", () => ({
  getUserProfile: vi.fn(async () => ({ uid: "viewer", username: "viewer", displayName: "Viewer", reputation: 0, savedPosts: {} })),
  toggleBookmark: vi.fn(),
}));
vi.mock("@/lib/posts", () => ({
  fetchPostById: vi.fn(),
  incrementPostViews: vi.fn(async () => {}),
  updatePost: vi.fn(), softDeletePost: vi.fn(),
}));
vi.mock("@/lib/comments", () => ({
  fetchComments: vi.fn(), addComment: vi.fn(),
  updateComment: vi.fn(), softDeleteComment: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const basePost: PostData = {
  id: "post-1", title: "An example post", body: "Post body", type: "discussion",
  author: { uid: "author", name: "Author", reputation: 0 },
  score: 0, commentCount: 3, tags: [], createdAt: Date.now(),
  isDeleted: false, allowComments: true,
};
const comments: CommentData[] = [
  { id: "root", author: "Author", authorUid: "author", reputation: 0, body: "Root comment", score: 0, createdAt: Date.now() },
  { id: "child", parentId: "root", author: "Reply author", authorUid: "other", reputation: 0, body: "Nested reply", score: 0, createdAt: Date.now() },
  { id: "grandchild", parentId: "child", author: "Third author", authorUid: "third", reputation: 0, body: "Deep reply", score: 0, createdAt: Date.now() },
];

const renderDetail = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/p/post-1"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes><Route path="/p/:id" element={<PostDetail />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe("post detail interaction states", () => {
  beforeEach(() => {
    authState.user = { uid: "viewer" };
    vi.clearAllMocks();
    vi.mocked(fetchPostById).mockResolvedValue({ ...basePost });
    vi.mocked(fetchComments).mockResolvedValue(comments);
    vi.mocked(incrementPostViews).mockResolvedValue(undefined);
    vi.mocked(addComment).mockResolvedValue("new-comment");
  });

  it("hides reply actions at every depth when comments are off but leaves earlier votes available", async () => {
    vi.mocked(fetchPostById).mockResolvedValue({ ...basePost, allowComments: false });
    renderDetail();

    expect(await screen.findByText("Deep reply")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3 Comments" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Share your thoughts...")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Vote/ })).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Vote grandchild" })).toBeEnabled();
  });

  it("freezes comment votes and replies on a removed post", async () => {
    vi.mocked(fetchPostById).mockResolvedValue({ ...basePost, isDeleted: true });
    renderDetail();

    expect(await screen.findByText("Deep reply")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vote post-1" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Vote/ })).toHaveLength(3);
    for (const button of screen.getAllByRole("button", { name: /^Vote/ })) expect(button).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Reply" })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Share your thoughts...")).not.toBeInTheDocument();
  });

  it("shows a retryable post fetch failure instead of not found", async () => {
    vi.mocked(fetchPostById).mockRejectedValueOnce(new Error("Transport failure"));
    renderDetail();
    expect(await screen.findByText("Couldn't load this post")).toBeInTheDocument();
    expect(screen.queryByText("Post not found")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("An example post")).toBeInTheDocument();
  });

  it("shows a retryable comment fetch failure rather than an empty discussion", async () => {
    vi.mocked(fetchComments).mockRejectedValueOnce(new Error("Transport failure"));
    renderDetail();
    expect(await screen.findByText("Couldn't load comments")).toBeInTheDocument();
    expect(screen.queryByText(/No comments yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Deep reply")).toBeInTheDocument();
  });

  it("reports bookmark failures to the user", async () => {
    vi.mocked(toggleBookmark).mockRejectedValueOnce(new Error("Bookmark could not be saved"));
    renderDetail();
    const bookmark = await screen.findByRole("button", { name: "Bookmark post" });
    fireEvent.click(bookmark);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Bookmark could not be saved"));
    expect(bookmark).toBeEnabled();
  });

  it("reports edit and delete failures without claiming success", async () => {
    vi.mocked(fetchPostById).mockResolvedValue({ ...basePost, author: { uid: "viewer", name: "Viewer", reputation: 0 } });
    vi.mocked(updatePost).mockRejectedValueOnce(new Error("Update blocked"));
    vi.mocked(softDeletePost).mockRejectedValueOnce(new Error("Delete blocked"));
    renderDetail();
    expect(await screen.findByText("An example post")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Edit Post/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Update blocked"));
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Delete Post/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Delete blocked"));
    expect(screen.getByText("An example post")).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalledWith("Post deleted");
  });

  it("shows a user-visible error when a comment submission fails", async () => {
    vi.mocked(addComment).mockRejectedValueOnce(new Error("Comment was rejected"));
    renderDetail();
    const textarea = await screen.findByPlaceholderText("Share your thoughts...");
    fireEvent.change(textarea, { target: { value: "A helpful thought" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Comment was rejected"));
    expect(textarea).toHaveValue("A helpful thought");
  });

  it("allows guests to read a public post and replies without exposing write actions", async () => {
    authState.user = null;
    renderDetail();
    expect(await screen.findByText("Post body")).toBeInTheDocument();
    expect(await screen.findByText("Deep reply")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Vote/ }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(screen.queryByPlaceholderText("Share your thoughts...")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bookmark post" })).not.toBeInTheDocument();
    // Phase 1: the sign-in link now carries the validated return path.
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?from=%2Fp%2Fpost-1");
    expect(addComment).not.toHaveBeenCalled();
  });
});
