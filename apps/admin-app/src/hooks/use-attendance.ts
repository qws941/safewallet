"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

interface AttendanceLog {
  id: string;
  userId: string;
  siteId: string;
  checkInTime: string;
  checkOutTime: string | null;
  result: string;
  source: string;
  userName: string | null;
  companyName: string | null;
  siteName: string | null;
}

interface AttendanceListResponse {
  items: AttendanceLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface UnmatchedRecord {
  id: string;
  externalId: string;
  name: string;
  companyName: string | null;
  checkInTime: string;
  siteId: string;
  siteName: string | null;
  reason: string | null;
}

export function useAttendanceLogs(
  page = 1,
  limit = 20,
  filters?: { date?: string; result?: string; search?: string },
) {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "attendance-logs", siteId, page, limit, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (filters?.date) params.set("date", filters.date);
      if (filters?.result) params.set("result", filters.result);
      if (filters?.search) params.set("search", filters.search);
      return apiFetch<{ data: AttendanceListResponse }>(
        `/admin/attendance-logs?${params}`,
      ).then((res) => res.data);
    },
    enabled: !!siteId,
  });
}

export function useUnmatchedRecords() {
  const siteId = useAuthStore((s) => s.currentSiteId);

  return useQuery({
    queryKey: ["admin", "unmatched", siteId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (siteId) params.set("siteId", siteId);
      return apiFetch<{ data: UnmatchedRecord[] }>(
        `/admin/attendance/unmatched?${params}`,
      ).then((res) => res.data);
    },
    enabled: !!siteId,
  });
}
