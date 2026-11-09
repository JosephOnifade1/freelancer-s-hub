import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationBell } from "./NotificationBell";
import { fetchNotifications, fetchUnreadNotificationCount, markNotificationRead } from "@/lib/notifications";
import { toast } from "sonner";

vi.mock("@/hooks/auth-context", () => ({ useAuth: () => ({ user: { uid: "reader" } }) }));
vi.mock("@/lib/notifications", () => ({
  fetchNotifications: vi.fn(), fetchUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(),
  notificationLink: () => "/p/post-1",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

function renderBell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NotificationBell />
    </MemoryRouter>
  </QueryClientProvider>);
}

async function openBell() {
  // Radix v2 opens its dropdown trigger on Enter/Space keydown (pointerdown
  // isn't available as PointerEvent in jsdom), so open via keyboard.
  fireEvent.keyDown(screen.getByRole("button", { name: /Notifications/ }), { key: "Enter" });
  return screen.findByText("View all notifications");
}

describe("notification bell failure states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchNotifications).mockResolvedValue([]);
    vi.mocked(fetchUnreadNotificationCount).mockResolvedValue(0);
  });

  it("offers retry when the list fails rather than claiming there is nothing", async () => {
    vi.mocked(fetchNotifications).mockRejectedValueOnce(new Error("Network down"));
    renderBell();
    await openBell();
    expect(await screen.findByText("Couldn't load notifications.")).toBeInTheDocument();
    expect(screen.queryByText(/Nothing yet/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
  });

  it("doesn't claim zero unread when count lookup fails", async () => {
    vi.mocked(fetchUnreadNotificationCount).mockRejectedValueOnce(new Error("Count failed"));
    renderBell();
    const trigger = await screen.findByRole("button", { name: "Notifications, unread count unavailable" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(await screen.findByText(/Unread count unavailable/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText(/Unread count unavailable/)).not.toBeInTheDocument());
  });

  it("surfaces a failed mark-as-read operation", async () => {
    vi.mocked(fetchNotifications).mockResolvedValue([{
      id: "n1", userId: "reader", type: "reply", entityId: "c1", contextId: "post-1",
      message: "A reply to your post", isRead: false, createdAt: Date.now(),
    }]);
    vi.mocked(fetchUnreadNotificationCount).mockResolvedValue(1);
    vi.mocked(markNotificationRead).mockRejectedValue(new Error("Couldn't mark read"));
    renderBell();
    await openBell();
    fireEvent.click(await screen.findByRole("button", { name: /A reply to your post/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't mark read"));
  });
});
