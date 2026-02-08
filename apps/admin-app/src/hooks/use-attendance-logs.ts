import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

export interface AttendanceLog {
  id: string;
  siteId: string;
  userId: string | null;
  externalWorkerId: string | null;
  checkinAt: string;
  result: "SUCCESS" | "FAIL";
  source: "FAS" | "MANUAL";
  createdAt: string;
  userName: string | null;
  error?: string; // Keeping this just in case
  similarity?: number; // Keeping this just in case
}

export interface UnmatchedWorker {
  id: string;
  externalWorkerId: string | null;
  siteId: string;
  siteName: string | null;
  checkinAt: string;
  source: "FAS" | "MANUAL";
  createdAt: string;
  name?: string; // Optional if not in API type but useful for UI
  companyName?: string; // Optional
}

export interface AttendanceLogsParams {
  siteId?: string;
  date?: string;
  result?: "SUCCESS" | "FAIL" | "ALL";
  page?: number;
  limit?: number;
}

export interface UnmatchedWorkersParams {
  siteId?: string;
  date?: string;
  page?: number;
  limit?: number;
}

export function useAttendanceLogs(params: AttendanceLogsParams = {}) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = params.siteId || currentSiteId;

  return useQuery({
    queryKey: ["admin", "attendance-logs", targetSiteId, params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (targetSiteId) query.set("siteId", targetSiteId);
      if (params.date) query.set("date", params.date);
      if (params.result && params.result !== "ALL")
        query.set("result", params.result);
      query.set("page", String(params.page ?? 1));
      query.set("limit", String(params.limit ?? 20));

      const response = await apiFetch<
        | { logs: AttendanceLog[]; total: number }
        | { data: { logs: AttendanceLog[]; total: number } }
      >(`/admin/attendance-logs?${query.toString()}`);

      // Handle potential wrapper
      if ("data" in response) {
        return response.data;
      }
      return response;
    },
    enabled: true,
  });
}

export function useUnmatchedWorkers(params: UnmatchedWorkersParams = {}) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const targetSiteId = params.siteId || currentSiteId;

  return useQuery({
    queryKey: ["admin", "unmatched-workers", targetSiteId, params],
    queryFn: async () => {
      const query = new URLSearchParams();
      if (targetSiteId) query.set("siteId", targetSiteId);
      if (params.date) query.set("date", params.date);
      query.set("page", String(params.page ?? 1));
      query.set("limit", String(params.limit ?? 20));

      const response = await apiFetch<
        | { records: UnmatchedWorker[]; pagination: any }
        | { data: { records: UnmatchedWorker[]; pagination: any } }
      >(`/admin/attendance/unmatched?${query.toString()}`);

      // Handle potential wrapper
      if ("data" in response) {
        return response.data;
      }
      return response;
    },
    enabled: true,
  });
}
