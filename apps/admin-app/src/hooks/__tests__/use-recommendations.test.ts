import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useExportRecommendations,
  useRecommendationStats,
  useRecommendations,
} from "@/hooks/use-recommendations";
import { createWrapper } from "@/hooks/__tests__/test-utils";

const mockApiFetch = vi.fn();
let currentSiteId: string | null = "site-1";
const _origCreateElement = document.createElement.bind(document);

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
vi.mock("@/stores/auth", () => ({
  useAuthStore: (
    selector: (state: {
      currentSiteId: string | null;
      tokens: { accessToken: string } | null;
    }) => unknown,
  ) => selector({ currentSiteId, tokens: { accessToken: "token" } }),
}));

describe("use-recommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSiteId = "site-1";
  });

  it("fetches recommendation list with query params", async () => {
    mockApiFetch.mockResolvedValue({
      items: [],
      pagination: { page: 1 },
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useRecommendations(1, 20, "2026-02-01", "2026-02-15"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/admin/recommendations?siteId=site-1&page=1&limit=20&startDate=2026-02-01&endDate=2026-02-15",
      ),
    );
  });

  it("fetches recommendation stats", async () => {
    mockApiFetch.mockResolvedValue({ totalRecommendations: 5 });
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useRecommendationStats("2026-02-01", "2026-02-28"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ totalRecommendations: 5 });
  });

  it("exports recommendations as blob download", async () => {
    const mockBlob = new Blob(["csv-data"], { type: "text/csv" });
    const mockResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const mockUrl = "blob:http://localhost/fake-url";
    vi.stubGlobal("URL", {
      ...globalThis.URL,
      createObjectURL: vi.fn().mockReturnValue(mockUrl),
      revokeObjectURL: vi.fn(),
    });

    const clickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = _origCreateElement(tag);
      if (tag === "a") {
        el.click = clickSpy;
      }
      return el;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useExportRecommendations(), {
      wrapper,
    });

    await result.current();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/admin/recommendations/export?"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(clickSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches recommendations without optional date params", async () => {
    mockApiFetch.mockResolvedValue({
      items: [],
      pagination: { page: 1 },
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRecommendations(1, 10), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = mockApiFetch.mock.calls[0][0] as string;
    expect(url).toContain("siteId=site-1");
    expect(url).not.toContain("startDate");
    expect(url).not.toContain("endDate");
  });

  it("fetches recommendation stats without dates", async () => {
    mockApiFetch.mockResolvedValue({ totalRecommendations: 0 });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRecommendationStats(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = mockApiFetch.mock.calls[0][0] as string;
    expect(url).not.toContain("startDate");
  });

  it("exports recommendations without optional params", async () => {
    currentSiteId = null;
    const mockBlob = new Blob(["csv"], { type: "text/csv" });
    const mockResponse = {
      ok: true,
      blob: vi.fn().mockResolvedValue(mockBlob),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    vi.stubGlobal("URL", {
      ...globalThis.URL,
      createObjectURL: vi.fn().mockReturnValue("blob:fake"),
      revokeObjectURL: vi.fn(),
    });

    const clickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = _origCreateElement(tag);
      if (tag === "a") el.click = clickSpy;
      return el;
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useExportRecommendations(), {
      wrapper,
    });
    await result.current();

    const fetchUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(fetchUrl).not.toContain("siteId");
    expect(clickSpy).toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
