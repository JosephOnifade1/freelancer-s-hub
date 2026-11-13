/**
 * Phase 2C — settings save consistency.
 *
 * Before this phase one "Save" wrote the username claim to Neon and displayName/bio/
 * website/status to Supabase. A failure in the second half left the form half-saved with
 * the handle already changed. These tests pin the new behaviour: both halves target
 * Neon, the fields travel in one request, and a failure is reported without pretending
 * success.
 *
 * jsdom with the profile client mocked. No database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const saveOwnProfile = vi.fn();
const claimUsernameOnServer = vi.fn();
const checkHandleAvailable = vi.fn();
const toast = vi.fn();

vi.mock("@/lib/profile-client", () => ({
  saveOwnProfile: (f: unknown) => saveOwnProfile(f),
  isProfileError: (r: { ok: boolean }) => r.ok === false,
  checkHandleAvailable: (u: string) => checkHandleAvailable(u),
}));

vi.mock("@/lib/profile-provisioning", () => ({
  claimUsernameOnServer: (u: string) => claimUsernameOnServer(u),
}));

vi.mock("@/hooks/use-toast", () => ({ toast: (t: unknown) => toast(t) }));

vi.mock("@/hooks/auth-context", () => ({
  useAuth: () => ({
    user: { uid: "11111111-1111-4111-8111-111111111111", email: "a@example.test", user_metadata: {} },
  }),
}));

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } }, isDemoMode: false }));

vi.mock("@/lib/auth", () => ({
  requestPasswordReset: vi.fn(),
  resendConfirmationEmail: vi.fn(),
}));

// The settings page loads the profile through `getUserProfile`.
const getUserProfile = vi.fn();
vi.mock("@/lib/users", () => ({
  getUserProfile: (id: string) => getUserProfile(id),
  checkUsernameAvailability: vi.fn(async () => true),
}));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const loadedProfile = {
  uid: "11111111-1111-4111-8111-111111111111",
  username: "ada",
  displayName: "Ada Lovelace",
  initial: "A",
  bio: "engineer",
  location: "London",
  website: "",
  joined: "2024",
  status: "Available",
  skills: [],
  reputation: 10,
  followers: 0,
  following: 0,
  avatarUrl: null,
  isVerifiedPro: false,
};

beforeEach(() => {
  saveOwnProfile.mockReset();
  claimUsernameOnServer.mockReset();
  checkHandleAvailable.mockResolvedValue({ ok: true, data: true });
  getUserProfile.mockResolvedValue(loadedProfile);
  toast.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function openSettings() {
  const Settings = (await import("@/views/Settings")).default;
  wrap(<Settings />);
  // Wait for the profile to load and the form to render.
  await waitFor(() => expect(screen.getByDisplayValue("Ada Lovelace")).toBeInTheDocument());
}

/**
 * The Save button stays disabled until the debounced availability probe confirms the
 * handle, so a user cannot submit an unchecked username. This waits for the real state
 * transition rather than a fixed timer.
 */
async function clickSaveWhenReady() {
  const button = screen.getByRole("button", { name: /save/i });
  await waitFor(() => expect(button).toBeEnabled(), { timeout: 3000 });
  fireEvent.click(button);
}

describe("settings save", () => {
  it("sends profile fields to the Neon endpoint, not to Supabase", async () => {
    saveOwnProfile.mockResolvedValue({ ok: true, data: { ...loadedProfile, bio: "engineer" } });
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(saveOwnProfile).toHaveBeenCalledTimes(1));
    const fields = saveOwnProfile.mock.calls[0][0] as Record<string, unknown>;
    expect(fields).toMatchObject({ displayName: "Ada Lovelace", bio: "engineer" });
    // No username change, so no claim.
    expect(claimUsernameOnServer).not.toHaveBeenCalled();
  });

  it("claims the username before sending the fields, so a failure leaves a coherent state", async () => {
    claimUsernameOnServer.mockResolvedValue({ status: "claimed", username: "ada_new" });
    saveOwnProfile.mockResolvedValue({ ok: true, data: { ...loadedProfile, username: "ada_new" } });
    await openSettings();

    const field = screen.getByDisplayValue("ada");
    fireEvent.change(field, { target: { value: "ada_new" } });

    await clickSaveWhenReady();

    await waitFor(() => expect(claimUsernameOnServer).toHaveBeenCalledWith("ada_new"));
    // The claim happens first; the fields follow.
    expect(saveOwnProfile).toHaveBeenCalled();
    const claimOrder = claimUsernameOnServer.mock.invocationCallOrder[0];
    const saveOrder = saveOwnProfile.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(saveOrder);
  });

  it("reports a failed save instead of claiming success", async () => {
    saveOwnProfile.mockResolvedValue({ ok: false, error: "error" });
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const messages = toast.mock.calls.map((call) => (call[0] as { title?: string }).title);
      expect(messages).toContain("Error saving profile");
    });
    // No success toast.
    const messages = toast.mock.calls.map((call) => (call[0] as { title?: string }).title);
    expect(messages).not.toContain("Saved");
  });

  it("explains the pre-provisioning case rather than showing a generic error", async () => {
    saveOwnProfile.mockResolvedValue({ ok: false, error: "not_provisioned" });
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const description = toast.mock.calls
        .map((call) => (call[0] as { description?: string }).description)
        .join(" ");
      expect(description).toMatch(/isn.t ready yet/i);
    });
  });

  it("does not send the fields when the username claim loses a race", async () => {
    claimUsernameOnServer.mockResolvedValue({ status: "taken" });
    await openSettings();

    const field = screen.getByDisplayValue("ada");
    fireEvent.change(field, { target: { value: "taken_handle" } });

    await clickSaveWhenReady();

    await waitFor(() => expect(claimUsernameOnServer).toHaveBeenCalled());
    // The fields must not be written under the old handle after the claim failed —
    // that is what produced the half-saved form this phase fixes.
    expect(saveOwnProfile).not.toHaveBeenCalled();
  });

  it("tells the user when the session expired", async () => {
    saveOwnProfile.mockResolvedValue({ ok: false, error: "unauthenticated" });
    await openSettings();

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      const description = toast.mock.calls
        .map((call) => (call[0] as { description?: string }).description)
        .join(" ");
      expect(description).toMatch(/session expired/i);
    });
  });
});
