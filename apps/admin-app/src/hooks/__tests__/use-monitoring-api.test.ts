import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useMonitoringMetrics,
  useMonitoringSummary,
  useMonitoringTopErrors,
} from "@/hooks/use-monitoring-api";
import { createWrapper } from "@/hooks/__tests__/test-utils";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

describe("use-monitoring-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches monitoring summary and unwraps data", async () => {
    mockApiFetch.mockResolvedValue({ totalRequests: 10 });
    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useMonitoringSummary(30), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ totalRequests: 10 });
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: ["monitoring", "summary", 30] }),
    ).toBeDefined();
  });

  it("builds metrics query with and without date range", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const { wrapper } = createWrapper();

    renderHook(
      () => useMonitoringMetrics("endpoint", "2026-02-01", "2026-02-14"),
      {
        wrapper,
      },
    );
    renderHook(() => useMonitoringMetrics(), { wrapper });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/admin/monitoring/metrics?groupBy=endpoint&from=2026-02-01&to=2026-02-14",
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/admin/monitoring/metrics?groupBy=time",
    );
  });

  it("builds top-errors query with optional date params", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const { wrapper } = createWrapper();

    renderHook(() => useMonitoringTopErrors("2026-02-01", "2026-02-14"), {
      wrapper,
    });
    renderHook(() => useMonitoringTopErrors(), { wrapper });

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/admin/monitoring/top-errors?from=2026-02-01&to=2026-02-14",
    );
    expect(mockApiFetch).toHaveBeenCalledWith("/admin/monitoring/top-errors?");
  });
});
