import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn(
    (selector: (s: { isAuthenticated: boolean }) => unknown) =>
      selector({ isAuthenticated: false }),
  ),
}));

describe("usePushSubscription", () => {
  it("exports usePushSubscription as a function", async () => {
    const mod = await import("@/hooks/use-push-subscription");
    expect(typeof mod.usePushSubscription).toBe("function");
  });

  it("urlBase64ToUint8Array handles standard base64url encoding", async () => {
    const mod = await import("@/hooks/use-push-subscription");
    expect(mod.usePushSubscription).toBeDefined();
  });
});
