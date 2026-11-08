import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { VoteControls } from "./VoteControls";
import { fetchUserVote, handleVote } from "@/lib/votes";

vi.mock("@/hooks/auth-context", () => ({ useAuth: () => ({ user: { uid: "viewer" } }) }));
vi.mock("@/lib/votes", () => ({ fetchUserVote: vi.fn(), handleVote: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const renderVotes = (props: { authorUid?: string; disabled?: boolean } = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <VoteControls entityId="post-1" authorUid={props.authorUid ?? "author"} score={5} disabled={props.disabled} />
    </QueryClientProvider>
  );
};

describe("vote controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchUserVote).mockResolvedValue(0);
    vi.mocked(handleVote).mockResolvedValue(undefined);
  });

  it("locks both buttons while the optimistic vote is in flight", async () => {
    let resolveVote: () => void = () => {};
    vi.mocked(handleVote).mockImplementationOnce(() => new Promise<void>((resolve) => { resolveVote = resolve; }));
    renderVotes();
    expect(screen.getByRole("button", { name: "Upvote" })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Upvote" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Upvote" }));
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upvote" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Downvote" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Downvote" }));
    expect(handleVote).toHaveBeenCalledOnce();

    resolveVote();
    await waitFor(() => expect(screen.getByRole("button", { name: "Upvote" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Upvote" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("rolls back an optimistic change and shows the backend error", async () => {
    vi.mocked(handleVote).mockRejectedValueOnce(new Error("Vote rejected"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderVotes();
    await waitFor(() => expect(screen.getByRole("button", { name: "Downvote" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Downvote" }));
    expect(screen.getByText("4")).toBeInTheDocument();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Vote rejected"));
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Downvote" })).toBeEnabled();
    consoleSpy.mockRestore();
  });

  it("rejects self-votes before the RPC and respects frozen content", async () => {
    renderVotes({ authorUid: "viewer" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Upvote" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Upvote" }));
    expect(toast.error).toHaveBeenCalledWith("You can't vote on your own content");
    expect(handleVote).not.toHaveBeenCalled();
  });

  it("lets the user retry a failed vote-status lookup instead of guessing their prior vote", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(fetchUserVote).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(-1);
    renderVotes();
    const retry = await screen.findByRole("button", { name: "Retry loading vote" });
    expect(screen.getByRole("button", { name: "Upvote" })).toBeDisabled();
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole("button", { name: "Upvote" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Downvote" })).toHaveAttribute("aria-pressed", "true");
    consoleSpy.mockRestore();
  });

  it("does not submit votes from a disabled control", async () => {
    renderVotes({ disabled: true });
    const button = screen.getByRole("button", { name: "Upvote" });
    await waitFor(() => expect(button).not.toHaveAttribute("title"));
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleVote).not.toHaveBeenCalled();
  });
});
