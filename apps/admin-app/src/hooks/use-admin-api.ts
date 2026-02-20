"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { apiFetch } from "./use-api-base";

export interface Member {
  id: string;
  user: {
    id: string;
    name: string;
  };
  status: string;
  role: string;
  joinedAt: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  scheduledAt: string | null;
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  performer: {
    id: string;
    name: string;
  } | null;
}

interface DashboardStats {
  totalUsers: number;
  totalSites: number;
  totalPosts: number;
  activeUsersToday: number;
  pendingCount: number;
  urgentCount: number;
  avgProcessingHours: number;
  categoryDistribution: Record<string, number>;
  todayPostsCount: number;
}

export interface ManualApproval {
  id: string;
  userId: string;
  siteId: string;
  approvedById?: string;
  reason: string;
  validDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason?: string;
  approvedAt?: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    companyName: string | null;
    tradeType: string | null;
  };
  approvedBy?: {
    id: string;
    name: string | null;
  };
}

export interface SiteMembership {
  id: string;
  siteId: string;
  siteName: string;
  status: string;
  role: string;
  joinedAt: string;
}

// Dashboard
export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const res = await apiFetch<{ stats: DashboardStats }>("/admin/stats");
      return res.stats;
    },
    refetchInterval: 30_000,
  });
}

// Members
export function useMembers(siteId?: string) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  return useQuery({
    queryKey: ["admin", "members", targetSiteId],
    queryFn: async () => {
      const res = await apiFetch<{ data: Member[]; pagination: unknown }>(
        `/sites/${targetSiteId}/members`,
      );
      return res.data;
    },
    enabled: !!targetSiteId,
  });
}

export function useMember(memberId: string) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "member", siteId, memberId],
    queryFn: async () => {
      const res = await apiFetch<{ member: Member }>(
        `/sites/${siteId}/members/${memberId}`,
      );
      return res.member;
    },
    enabled: !!siteId && !!memberId,
  });
}

// Announcements
export function useAdminAnnouncements() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "announcements", siteId],
    queryFn: () => apiFetch<Announcement[]>(`/announcements?siteId=${siteId}`),
    enabled: !!siteId,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useMutation({
    mutationFn: ({
      title,
      content,
      isPinned,
      scheduledAt,
    }: {
      title: string;
      content: string;
      isPinned?: boolean;
      scheduledAt?: string | null;
    }) =>
      apiFetch(`/announcements`, {
        method: "POST",
        body: JSON.stringify({ siteId, title, content, isPinned, scheduledAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      title,
      content,
      isPinned,
      scheduledAt,
    }: {
      id: string;
      title: string;
      content: string;
      isPinned?: boolean;
      scheduledAt?: string | null;
    }) =>
      apiFetch(`/announcements/${id}`, {
        method: "PUT",
        body: JSON.stringify({ title, content, isPinned, scheduledAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/announcements/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ["admin", "audit"],
    queryFn: async () => {
      const res = await apiFetch<{ logs: AuditLog[] }>(
        "/admin/audit-logs?limit=100",
      );
      return res.logs;
    },
  });
}

export function useMySites() {
  const userRole = useAuthStore((s) => s.user?.role);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  return useQuery({
    queryKey: ["admin", "my-sites", userRole],
    queryFn: async () => {
      const res = await apiFetch<{
        memberships: Array<{
          id: string;
          role: string;
          status: string;
          joinedAt: string;
          site: { id: string; name: string; active: boolean };
        }>;
      }>("/users/me/memberships");
      const memberships = res.memberships.map((m) => ({
        id: m.id,
        siteId: m.site.id,
        siteName: m.site.name,
        status: m.status,
        role: m.role,
        joinedAt: m.joinedAt,
      }));

      if (memberships.length > 0) {
        return memberships;
      }

      if (userRole === "SUPER_ADMIN") {
        const sitesRes = await apiFetch<{
          data: Array<{ id: string; name: string }>;
        }>("/sites");
        return sitesRes.data.map((site) => ({
          id: `super-admin-${site.id}`,
          siteId: site.id,
          siteName: site.name,
          status: "ACTIVE",
          role: "SUPER_ADMIN",
          joinedAt: new Date(0).toISOString(),
        }));
      }

      return memberships;
    },
    enabled: hasHydrated && isAdmin,
  });
}

export function useManualApprovals(
  siteId?: string,
  date?: string,
  status?: string,
) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  const params = new URLSearchParams();
  if (targetSiteId) params.set("siteId", targetSiteId);
  if (date) params.set("date", date);
  if (status) params.set("status", status);

  return useQuery({
    queryKey: ["admin", "manual-approvals", targetSiteId, date, status],
    queryFn: async () => {
      const res = await apiFetch<{
        data: ManualApproval[];
        pagination: unknown;
      }>(`/approvals?${params.toString()}`);
      return res.data;
    },
    enabled: !!targetSiteId,
  });
}

export function useApproveManualRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/approvals/${id}/approve`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "manual-approvals"],
      });
    },
  });
}

export function useRejectManualRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch(`/approvals/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "manual-approvals"],
      });
    },
  });
}

export function useCreateManualApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      userId: string;
      siteId: string;
      reason: string;
      validDate: string;
    }) =>
      apiFetch("/admin/manual-approval", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["admin", "manual-approvals", variables.siteId],
      });
    },
  });
}
