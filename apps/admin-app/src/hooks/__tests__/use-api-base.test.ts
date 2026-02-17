import { describe, expect, it, vi } from "vitest";

// Mock the underlying lib/api module
const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: mockApiFetch,
}));

describe("use-api-base", () => {
  it("re-exports apiFetch from @/lib/api", async () => {
    const { apiFetch } = await import("@/hooks/use-api-base");
    expect(apiFetch).toBe(mockApiFetch);
  });

  it("apiFetch is callable and delegates to lib/api", async () => {
    const { apiFetch } = await import("@/hooks/use-api-base");
    mockApiFetch.mockResolvedValue({ success: true });

    const result = await apiFetch("/test");

    expect(mockApiFetch).toHaveBeenCalledWith("/test");
    expect(result).toEqual({ success: true });
  });
});
