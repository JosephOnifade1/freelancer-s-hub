import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CreatePost from "@/views/CreatePost";
import { createPost } from "@/lib/posts";
import { fetchAllCommunities, type CommunityData } from "@/lib/communities";
import { getUserProfile } from "@/lib/users";
import { uploadPostDocuments, type PostAttachment } from "@/lib/attachments";
import { readDraft } from "@/lib/drafts";

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/editor/ResourceBodyEditor", () => ({ ResourceBodyEditor: () => <div /> }));
vi.mock("@/components/editor/ResourceMarkdownHelp", () => ({ ResourceMarkdownHelp: () => <div /> }));
vi.mock("@/hooks/auth-context", () => ({ useAuth: () => ({ user: { uid: "user-1" } }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/uploads", () => ({ uploadImage: vi.fn() }));
vi.mock("@/lib/attachments", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/attachments")>(),
  uploadPostDocuments: vi.fn(),
}));
vi.mock("@/lib/posts", () => ({ createPost: vi.fn(async () => "created-post") }));
vi.mock("@/lib/users", () => ({ getUserProfile: vi.fn() }));
vi.mock("@/lib/communities", () => ({
  fetchAllCommunities: vi.fn(),
  getCommunityStyle: () => ({ icon: "span", iconBg: "bg-muted" }),
}));

const spaces: CommunityData[] = [
  { slug: "dev", name: "Developers", category: "Development", topics: ["typescript"], description: "Code", ownerId: "user-2", memberCount: 1, createdAt: "2026-01-01" },
  { slug: "design", name: "Designers", category: "Design", topics: ["ui"], description: "Design", ownerId: "user-3", memberCount: 1, createdAt: "2026-01-01" },
];

const mockUploaded = (fileName: string): PostAttachment => ({
  id: `att-${fileName}`,
  postId: "created-post",
  uploaderUid: "user-1",
  storagePath: `user-1/created-post/${fileName}`,
  fileName,
  mimeType: "application/pdf",
  fileSize: 100,
  createdAt: "2026-01-01T00:00:00Z",
});

const renderComposer = (url: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/create" element={<CreatePost />} />
          <Route path="/p/:id" element={<p>Profile post detail</p>} />
          <Route path="/b/:slug/p/:id" element={<p>Space post detail</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const fillPost = () => {
  fireEvent.change(screen.getByPlaceholderText(/Post title/), { target: { value: "A useful post" } });
  fireEvent.change(screen.getByPlaceholderText(/Share your thoughts/), { target: { value: "Here is the content." } });
};

describe("main post composer targets", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(fetchAllCommunities).mockResolvedValue(spaces);
    vi.mocked(uploadPostDocuments).mockResolvedValue({ uploaded: [], failed: [] });
    vi.mocked(getUserProfile).mockResolvedValue({
      uid: "user-1", username: "alice", displayName: "Alice", initial: "A",
      bio: "", location: "", website: "", joined: "2026", status: "Available",
      skills: [], reputation: 0, followers: 0, following: 0,
    });
  });

  it("publishes a profile post with a null community slug", async () => {
    renderComposer("/create");
    const publish = await screen.findByRole("button", { name: /Post to Profile/ }, { timeout: 3000 });
    fillPost();
    fireEvent.click(publish);

    await waitFor(() => expect(createPost).toHaveBeenCalledOnce());
    expect(vi.mocked(createPost).mock.calls[0][0]).toMatchObject({
      title: "A useful post", communitySlug: null, visibility: "public", isPinned: false,
      author: { uid: "user-1" },
    });
    expect(await screen.findByText("Profile post detail")).toBeInTheDocument();
  });

  it("publishes a preselected real space post with the canonical slug", async () => {
    renderComposer("/create?space=dev");
    const publish = await screen.findByRole("button", { name: "Post to Developers" });
    fillPost();
    fireEvent.click(publish);

    await waitFor(() => expect(createPost).toHaveBeenCalledOnce());
    expect(vi.mocked(createPost).mock.calls[0][0]).toMatchObject({
      title: "A useful post", communitySlug: "dev", author: { uid: "user-1" },
    });
    expect(await screen.findByText("Space post detail")).toBeInTheDocument();
  });

  it("never silently changes an unknown preselected space into a profile post", async () => {
    renderComposer("/create?space=does-not-exist");
    expect(await screen.findByText("Space unavailable — choose a target")).toBeInTheDocument();
    const publish = screen.getByRole("button", { name: "Choose a target" });
    expect(publish).toBeDisabled();
    expect(createPost).not.toHaveBeenCalled();
  });

  it("shows a retryable error when the requested space list cannot be loaded", async () => {
    vi.mocked(fetchAllCommunities).mockRejectedValueOnce(new Error("Backend unavailable"));
    renderComposer("/create?space=dev");
    expect(await screen.findByText("Couldn't load spaces")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose a target" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Post to Developers" })).toBeEnabled();
  });

  it("retains only failed documents and retries without creating a second post", async () => {
    const { container } = renderComposer("/create");
    const publish = await screen.findByRole("button", { name: /Post to Profile/ });
    fillPost();
    const files = [
      new File(["first"], "first.pdf", { type: "application/pdf" }),
      new File(["second"], "second.pdf", { type: "application/pdf" }),
    ];
    const input = container.querySelector<HTMLInputElement>('input[accept=".pdf,.txt,.csv,.doc,.docx,.xlsx"]')!;
    fireEvent.change(input, { target: { files } });
    expect(await screen.findByText(/2 documents queued/)).toBeInTheDocument();
    vi.mocked(uploadPostDocuments)
      .mockResolvedValueOnce({ uploaded: [mockUploaded("first.pdf")], failed: [] })
      .mockResolvedValueOnce({ uploaded: [], failed: [{ file: files[1], error: "Network error" }] })
      .mockResolvedValueOnce({ uploaded: [mockUploaded("second.pdf")], failed: [] });
    fireEvent.click(publish);

    expect(await screen.findByRole("button", { name: "Retry document uploads" })).toBeInTheDocument();
    expect(createPost).toHaveBeenCalledTimes(1);
    expect(screen.getByText("second.pdf")).toBeInTheDocument();
    expect(screen.queryByText("first.pdf")).not.toBeInTheDocument();
    expect(readDraft("user-1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry document uploads" }));
    expect(await screen.findByText("Profile post detail")).toBeInTheDocument();
    expect(createPost).toHaveBeenCalledTimes(1);
    expect(vi.mocked(uploadPostDocuments).mock.calls.map(([_, [file]]) => file.name)).toEqual([
      "first.pdf", "second.pdf", "second.pdf",
    ]);
  });

  it("restores the signed-in account's text and ignores another account's draft", async () => {
    const draft = {
      title: "My saved note", body: "I was writing this earlier", postType: "discussion",
      selectedTargetId: "profile:user-1", tags: ["trust"], externalLink: "", pollOptions: ["Option 1", "Option 2"],
      videoUrl: "", bodyImages: [], visibility: "public", allowComments: true, pinToSpace: false,
    };
    localStorage.setItem("borynx_post_draft:other-user", JSON.stringify({ ...draft, title: "Someone else's draft", userUid: "other-user" }));
    localStorage.setItem("borynx_post_draft:user-1", JSON.stringify({ ...draft, userUid: "user-1" }));
    renderComposer("/create");
    expect(await screen.findByText(/Your draft was restored/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Post title/)).toHaveValue("My saved note");
    expect(screen.getByPlaceholderText(/Share your thoughts/)).toHaveValue("I was writing this earlier");
    expect(screen.queryByText("Someone else's draft")).not.toBeInTheDocument();
  });
});
