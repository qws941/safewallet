import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAttendanceLogs,
  useUnmatchedRecords,
  useUnmatchedWorkers,
} from "@/hooks/use-attendance";
import { createWrapper } from "@/hooks/__tests__/test-utils";

const mockApiFetch = vi.fn();
let currentSiteId: string | null = "site-1";

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
vi.mock("@/stores/auth", () => ({
  useAuthStore: (
    selector: (state: { currentSiteId: string | null }) => unknown,
  ) => selector({ currentSiteId }),
}));

describe("use-attendance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSiteId = "site-1";
  });

  it("fetches attendance logs with pagination filters", async () => {
    mockApiFetch.mockResolvedValue({ logs: [], pagination: {} });
    const { wrapper } = createWrapper();

    renderHook(
      () => useAttendanceLogs(2, 10, { date: "2026-02-14", search: "홍길동" }),
      {
        wrapper,
      },
    );

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/admin/attendance-logs?siteId=site-1&page=2&limit=10&date=2026-02-14&search=%ED%99%8D%EA%B8%B8%EB%8F%99",
      ),
    );
  });

  it("normalizes unmatched worker response shape", async () => {
    mockApiFetch.mockResolvedValue({
      records: [{ id: "w1" }],
      pagination: { page: 1 },
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnmatchedWorkers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      records: [{ id: "w1" }],
      pagination: { page: 1 },
    });
  });

  it("fetches unmatched records for current site", async () => {
    mockApiFetch.mockResolvedValue({ records: [{ id: "r1" }], pagination: {} });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnmatchedRecords(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/admin/attendance/unmatched?siteId=site-1",
    );
  });

  it("returns unmatched worker data directly from apiFetch", async () => {
    mockApiFetch.mockResolvedValue({
      records: [{ id: "w2" }],
      pagination: { page: 1 },
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnmatchedWorkers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      records: [{ id: "w2" }],
      pagination: { page: 1 },
    });
  });

  it("includes result filter in attendance logs query", async () => {
    mockApiFetch.mockResolvedValue({ logs: [], pagination: {} });
    const { wrapper } = createWrapper();
    renderHook(() => useAttendanceLogs(1, 10, { result: "FAIL" }), { wrapper });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("result=FAIL"),
    );
  });

  it("fetches unmatched workers without date param", async () => {
    mockApiFetch.mockResolvedValue({ records: [], pagination: {} });
    const { wrapper } = createWrapper();
    renderHook(() => useUnmatchedWorkers("site-50", { page: 1, limit: 10 }), {
      wrapper,
    });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    const url = mockApiFetch.mock.calls[0][0] as string;
    expect(url).toContain("siteId=site-50");
    expect(url).not.toContain("date=");
  });

  it("passes explicit siteId and optional params to unmatched workers", async () => {
    mockApiFetch.mockResolvedValue({ records: [], pagination: {} });
    const { wrapper } = createWrapper();
    renderHook(
      () =>
        useUnmatchedWorkers("site-99", {
          date: "2026-02-14",
          page: 2,
          limit: 5,
        }),
      { wrapper },
    );

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("siteId=site-99"),
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("date=2026-02-14"),
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("page=2"),
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("limit=5"),
    );
  });
});
