import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAdminAnnouncements,
  useAuditLogs,
  useCreateAnnouncement,
  useCreateManualApproval,
  useDeleteAnnouncement,
  useApproveManualRequest,
  useDashboardStats,
  useManualApprovals,
  useMember,
  useMembers,
  useMySites,
  useRejectManualRequest,
  useUpdateAnnouncement,
} from "@/hooks/use-admin-api";
import { createWrapper } from "@/hooks/__tests__/test-utils";

const mockApiFetch = vi.fn();
let currentSiteId: string | null = "site-1";

vi.mock("@/hooks/use-api-base", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));
vi.mock("@/stores/auth", () => ({
  useAuthStore: (
    selector: (state: { currentSiteId: string | null }) => unknown,
  ) => selector({ currentSiteId }),
}));

describe("use-admin-api hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSiteId = "site-1";
  });

  it("uses dashboard query key and calls stats endpoint", async () => {
    mockApiFetch.mockResolvedValue({ stats: { pendingReviews: 1 } });
    const { wrapper, queryClient } = createWrapper();

    const { result } = renderHook(() => useDashboardStats(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ pendingReviews: 1 });
    expect(
      queryClient.getQueryCache().find({ queryKey: ["dashboard", "stats"] }),
    ).toBeDefined();
    expect(mockApiFetch).toHaveBeenCalledWith("/admin/stats");
  });

  it("disables members query when siteId is missing", () => {
    currentSiteId = null;
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMembers(), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it("invalidates manual approvals on approve mutation success", async () => {
    mockApiFetch.mockResolvedValue({ ok: true });
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useApproveManualRequest(), { wrapper });
    await result.current.mutateAsync("approval-1");

    expect(mockApiFetch).toHaveBeenCalledWith("/approvals/approval-1/approve", {
      method: "POST",
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin", "manual-approvals"],
    });
  });

  it("uses explicit site id when fetching members", async () => {
    mockApiFetch.mockResolvedValue([{ id: "member-1" }]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMembers("site-2"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith("/sites/site-2/members");
  });

  it("fetches single member and disables when member id is missing", async () => {
    mockApiFetch.mockResolvedValue({ id: "member-1" });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMember("member-1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith("/sites/site-1/members/member-1");

    const disabled = renderHook(() => useMember(""), { wrapper });
    expect(disabled.result.current.fetchStatus).toBe("idle");
  });

  it("queries and mutates announcements with cache invalidation", async () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    mockApiFetch.mockResolvedValueOnce([{ id: "a1" }]);
    const announcements = renderHook(() => useAdminAnnouncements(), {
      wrapper,
    });
    await waitFor(() =>
      expect(announcements.result.current.isSuccess).toBe(true),
    );
    expect(mockApiFetch).toHaveBeenCalledWith("/announcements?siteId=site-1");

    mockApiFetch.mockResolvedValue({ ok: true });
    const create = renderHook(() => useCreateAnnouncement(), { wrapper });
    await create.result.current.mutateAsync({ title: "t", content: "c" });

    const update = renderHook(() => useUpdateAnnouncement(), { wrapper });
    await update.result.current.mutateAsync({
      id: "a1",
      title: "t",
      content: "c",
    });

    const remove = renderHook(() => useDeleteAnnouncement(), { wrapper });
    await remove.result.current.mutateAsync("a1");

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin", "announcements"],
    });
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/announcements",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/announcements/a1",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/announcements/a1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("unwraps audit logs and loads my sites", async () => {
    const { wrapper } = createWrapper();
    mockApiFetch
      .mockResolvedValueOnce({ logs: [{ id: "log-1" }] })
      .mockResolvedValueOnce([{ siteId: "site-1" }]);

    const audit = renderHook(() => useAuditLogs(), { wrapper });
    await waitFor(() => expect(audit.result.current.isSuccess).toBe(true));
    expect(audit.result.current.data).toEqual([{ id: "log-1" }]);

    const sites = renderHook(() => useMySites(), { wrapper });
    await waitFor(() => expect(sites.result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith("/users/me/memberships");
  });

  it("builds manual approvals query and handles reject/create mutations", async () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    mockApiFetch.mockResolvedValueOnce([{ id: "m1" }]);
    const query = renderHook(
      () => useManualApprovals("site-2", "2026-02-15", "PENDING"),
      { wrapper },
    );
    await waitFor(() => expect(query.result.current.isSuccess).toBe(true));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/approvals?siteId=site-2&date=2026-02-15&status=PENDING",
    );

    mockApiFetch.mockResolvedValue({ ok: true });
    const reject = renderHook(() => useRejectManualRequest(), { wrapper });
    await reject.result.current.mutateAsync({ id: "m1", reason: "bad" });

    const create = renderHook(() => useCreateManualApproval(), { wrapper });
    await create.result.current.mutateAsync({
      userId: "u1",
      siteId: "site-2",
      reason: "valid reason",
      validDate: "2026-02-15",
    });

    expect(mockApiFetch).toHaveBeenCalledWith(
      "/approvals/m1/reject",
      expect.objectContaining({ method: "POST" }),
    );
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/admin/manual-approval",
      expect.objectContaining({ method: "POST" }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin", "manual-approvals"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["admin", "manual-approvals", "site-2"],
    });
  });

  it("disables site-bound queries when no site id exists", () => {
    currentSiteId = null;
    const { wrapper } = createWrapper();

    const approvals = renderHook(() => useManualApprovals(), { wrapper });
    const announcements = renderHook(() => useAdminAnnouncements(), {
      wrapper,
    });

    expect(approvals.result.current.fetchStatus).toBe("idle");
    expect(announcements.result.current.fetchStatus).toBe("idle");
  });
});
