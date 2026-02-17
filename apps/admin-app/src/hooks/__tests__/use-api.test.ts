import { describe, expect, it } from "vitest";
import * as barrel from "@/hooks/use-api";

/**
 * use-api.ts is a barrel re-export file.
 * This test verifies that all domain modules are properly re-exported.
 */
describe("use-api barrel exports", () => {
  it("re-exports apiFetch from use-api-base", () => {
    expect(barrel.apiFetch).toBeDefined();
    expect(typeof barrel.apiFetch).toBe("function");
  });

  it("re-exports admin hooks from use-admin-api", () => {
    expect(typeof barrel.useDashboardStats).toBe("function");
    expect(typeof barrel.useMembers).toBe("function");
    expect(typeof barrel.useMember).toBe("function");
    expect(typeof barrel.useAuditLogs).toBe("function");
    expect(typeof barrel.useMySites).toBe("function");
    expect(typeof barrel.useManualApprovals).toBe("function");
  });

  it("re-exports post hooks from use-posts-api", () => {
    expect(typeof barrel.useAdminPosts).toBe("function");
    expect(typeof barrel.useAdminPost).toBe("function");
    expect(typeof barrel.useReviewPost).toBe("function");
  });

  it("re-exports action hooks from use-actions-api", () => {
    expect(typeof barrel.useCreateAction).toBe("function");
    expect(typeof barrel.useActionItems).toBe("function");
    expect(typeof barrel.useUpdateAction).toBe("function");
  });

  it("re-exports attendance hooks from use-attendance", () => {
    expect(typeof barrel.useAttendanceLogs).toBe("function");
    expect(typeof barrel.useUnmatchedRecords).toBe("function");
    expect(typeof barrel.useUnmatchedWorkers).toBe("function");
  });

  it("re-exports points hooks from use-points-api", () => {
    expect(typeof barrel.usePointsLedger).toBe("function");
    expect(typeof barrel.useAwardPoints).toBe("function");
    expect(typeof barrel.usePolicies).toBe("function");
    expect(typeof barrel.useCreatePolicy).toBe("function");
    expect(typeof barrel.useUpdatePolicy).toBe("function");
    expect(typeof barrel.useDeletePolicy).toBe("function");
  });

  it("re-exports sites hooks from use-sites-api", () => {
    expect(typeof barrel.useSite).toBe("function");
    expect(typeof barrel.useUpdateSite).toBe("function");
  });

  it("re-exports monitoring hooks from use-monitoring-api", () => {
    expect(typeof barrel.useMonitoringSummary).toBe("function");
    expect(typeof barrel.useMonitoringMetrics).toBe("function");
    expect(typeof barrel.useMonitoringTopErrors).toBe("function");
  });

  it("re-exports rewards hooks from use-rewards", () => {
    expect(typeof barrel.useMonthlyRankings).toBe("function");
    expect(typeof barrel.useAllTimeRankings).toBe("function");
    expect(typeof barrel.usePointsHistory).toBe("function");
    expect(typeof barrel.useRevokePoints).toBe("function");
  });
});
