"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface FasSyncUserStats {
  total: number;
  fasLinked: number;
  missingPhone: number;
  deleted: number;
}

export interface FasSyncErrorCounts {
  open: number;
  resolved: number;
  ignored: number;
}

export interface FasSyncLogEntry {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string | null;
}

export interface FasSyncStatusResponse {
  fasStatus: string | null;
  lastFullSync: string | null;
  userStats: FasSyncUserStats;
  syncErrorCounts: FasSyncErrorCounts;
  recentSyncLogs: FasSyncLogEntry[];
}

export function useFasSyncStatus() {
  return useQuery({
    queryKey: ["admin", "fas-sync-status"],
    queryFn: () => apiFetch<FasSyncStatusResponse>("/admin/fas/sync-status"),
    refetchInterval: 30_000,
  });
}
