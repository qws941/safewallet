"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AttendanceLog {
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

export interface AttendanceListResponse {
  items: AttendanceLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UnmatchedRecord {
  id: string;
  externalId: string;
  name: string;
  companyName: string | null;
  checkInTime: string;
  siteId: string;
  siteName: string | null;
  reason: string | null;
}

export interface AttendanceLogsParams {
  date?: string;
  result?: "SUCCESS" | "FAIL";
  page?: number;
  limit?: number;
}

export interface AttendanceLogItem {
  id: string;
  siteId: string;
  userId: string | null;
  externalWorkerId: string | null;
  checkinAt: string;
  result: "SUCCESS" | "FAIL";
  source: "FAS" | "MANUAL";
  createdAt: string;
  userName: string | null;
}

export interface AttendanceLogsApiResponse {
  logs: AttendanceLogItem[];
  pagination: PaginationMeta;
}

export interface UnmatchedWorkersParams {
  date?: string;
  page?: number;
  limit?: number;
}

export interface UnmatchedWorkerItem {
  id: string;
  externalWorkerId: string | null;
  siteId: string;
  siteName: string | null;
  checkinAt: string;
  source: "FAS" | "MANUAL";
  createdAt: string;
}

export interface UnmatchedWorkersResponse {
  records: UnmatchedWorkerItem[];
  pagination: PaginationMeta;
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

export function useUnmatchedWorkers(
  siteId?: string,
  params?: UnmatchedWorkersParams,
) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = siteId || currentSiteId;

  return useQuery({
    queryKey: ["admin", "attendance-unmatched", targetSiteId, params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (targetSiteId) query.set("siteId", targetSiteId);
      if (params?.date) query.set("date", params.date);
      if (params?.page !== undefined) query.set("page", String(params.page));
      if (params?.limit !== undefined) {
        query.set("limit", String(params.limit));
      }

      const response = await apiFetch<
        UnmatchedWorkersResponse | { data: UnmatchedWorkersResponse }
      >(`/admin/attendance/unmatched?${query.toString()}`);

      return "data" in response ? response.data : response;
    },
    enabled: !!targetSiteId,
  });
}
